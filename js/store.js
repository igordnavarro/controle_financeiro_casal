// Camada de dados: Firebase (login Google + Firestore em tempo real, com cache offline)
// ou, se o Firebase ainda não foi configurado, armazenamento local no navegador.
import { firebaseConfig, EMAILS_PERMITIDOS, CASA_ID } from "./config.js";

const FB_VER = "10.12.2";
const COLECOES = ["despesas", "cartoes", "rendas", "faturas"];

export const firebaseConfigurado = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------
// Modo local (sem Firebase)
// ---------------------------------------------------------------------
class LocalStore {
  constructor() {
    this.modo = "local";
    this.ouvintes = {};
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("fc_")) this._emitir(e.key.slice(3));
    });
  }
  async iniciar(aoMudarUsuario) {
    aoMudarUsuario({ nome: "Modo local", email: "", foto: "" });
  }
  async entrar() {}
  async sair() {}
  _ler(col) {
    try { return JSON.parse(localStorage.getItem("fc_" + col) || (col === "ajustes" ? "null" : "[]")); }
    catch { return col === "ajustes" ? null : []; }
  }
  _gravar(col, valor) {
    localStorage.setItem("fc_" + col, JSON.stringify(valor));
    this._emitir(col);
  }
  _emitir(col) {
    (this.ouvintes[col] || []).forEach((cb) => cb(this._ler(col)));
  }
  observar(col, cb) {
    (this.ouvintes[col] ||= []).push(cb);
    cb(this._ler(col));
    return () => { this.ouvintes[col] = this.ouvintes[col].filter((f) => f !== cb); };
  }
  observarAjustes(cb) { return this.observar("ajustes", cb); }
  async salvarAjustes(dados) { this._gravar("ajustes", dados); }
  async adicionar(col, dados) {
    const lista = this._ler(col);
    const item = { ...dados, id: dados.id || novoId(), criadoEm: Date.now() };
    lista.push(item);
    this._gravar(col, lista);
    return item.id;
  }
  async atualizar(col, id, dados) {
    this._gravar(col, this._ler(col).map((i) => (i.id === id ? { ...i, ...dados } : i)));
  }
  async remover(col, id) {
    this._gravar(col, this._ler(col).filter((i) => i.id !== id));
  }
  // cria ou mescla um documento com id conhecido
  async definir(col, id, dados) {
    const lista = this._ler(col);
    const i = lista.findIndex((x) => x.id === id);
    if (i >= 0) lista[i] = { ...lista[i], ...dados }; else lista.push({ ...dados, id });
    this._gravar(col, lista);
  }
  // ops: [{tipo:'add'|'update'|'delete', col, id?, dados?}]
  async lote(ops) {
    const porCol = {};
    for (const c of COLECOES) porCol[c] = this._ler(c);
    for (const op of ops) {
      const lista = porCol[op.col];
      if (op.tipo === "add") {
        const item = { ...op.dados, id: op.id || novoId(), criadoEm: Date.now() };
        const j = op.id ? lista.findIndex((x) => x.id === op.id) : -1;
        if (j >= 0) lista[j] = item; else lista.push(item);
      }
      else if (op.tipo === "update") { const i = lista.findIndex((x) => x.id === op.id); if (i >= 0) lista[i] = { ...lista[i], ...op.dados }; }
      else if (op.tipo === "delete") porCol[op.col] = lista.filter((x) => x.id !== op.id);
    }
    for (const c of COLECOES) localStorage.setItem("fc_" + c, JSON.stringify(porCol[c]));
    COLECOES.forEach((c) => this._emitir(c));
  }
}

// ---------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------
class FirebaseStore {
  constructor() { this.modo = "firebase"; }

  async iniciar(aoMudarUsuario, aoErro) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}`;
    const [{ initializeApp }, authMod, fs] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`)
    ]);
    this.fs = fs;
    this.authMod = authMod;
    const app = initializeApp(firebaseConfig);
    this.auth = authMod.getAuth(app);
    this.db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
    });
    try { await authMod.getRedirectResult(this.auth); } catch (e) { aoErro?.(e); }
    authMod.onAuthStateChanged(this.auth, async (u) => {
      if (!u) return aoMudarUsuario(null);
      const email = (u.email || "").toLowerCase();
      const permitidos = EMAILS_PERMITIDOS.map((e) => e.toLowerCase());
      if (!permitidos.includes(email)) {
        await authMod.signOut(this.auth);
        aoErro?.(new Error(`O e-mail ${email} não tem acesso. Adicione-o em js/config.js e no firestore.rules.`));
        return aoMudarUsuario(null);
      }
      aoMudarUsuario({ nome: u.displayName || email, email, foto: u.photoURL || "" });
    });
  }

  async entrar() {
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = this.authMod;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(this.auth, provider);
    } catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
        await signInWithRedirect(this.auth, provider);
      } else if (e.code !== "auth/popup-closed-by-user") {
        throw e;
      }
    }
  }
  async sair() { await this.authMod.signOut(this.auth); }

  _col(col) { return this.fs.collection(this.db, "casas", CASA_ID, col); }
  _doc(col, id) { return this.fs.doc(this.db, "casas", CASA_ID, col, id); }

  observar(col, cb) {
    return this.fs.onSnapshot(this._col(col), (snap) => {
      cb(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    }, (e) => console.error(col, e));
  }
  observarAjustes(cb) {
    return this.fs.onSnapshot(this.fs.doc(this.db, "casas", CASA_ID), (d) => cb(d.exists() ? d.data().ajustes || null : null));
  }
  async salvarAjustes(dados) {
    await this.fs.setDoc(this.fs.doc(this.db, "casas", CASA_ID), { ajustes: dados }, { merge: true });
  }
  async adicionar(col, dados) {
    const ref = this.fs.doc(this._col(col));
    await this.fs.setDoc(ref, { ...dados, criadoEm: Date.now() });
    return ref.id;
  }
  async atualizar(col, id, dados) { await this.fs.updateDoc(this._doc(col, id), dados); }
  async remover(col, id) { await this.fs.deleteDoc(this._doc(col, id)); }
  async definir(col, id, dados) { await this.fs.setDoc(this._doc(col, id), dados, { merge: true }); }
  async lote(ops) {
    // Firestore aceita até 500 operações por lote
    for (let i = 0; i < ops.length; i += 450) {
      const b = this.fs.writeBatch(this.db);
      for (const op of ops.slice(i, i + 450)) {
        if (op.tipo === "add") b.set(op.id ? this._doc(op.col, op.id) : this.fs.doc(this._col(op.col)), { ...op.dados, criadoEm: Date.now() });
        else if (op.tipo === "update") b.update(this._doc(op.col, op.id), op.dados);
        else if (op.tipo === "delete") b.delete(this._doc(op.col, op.id));
      }
      await b.commit();
    }
  }
}

export const store = firebaseConfigurado ? new FirebaseStore() : new LocalStore();
export { COLECOES, novoId };
