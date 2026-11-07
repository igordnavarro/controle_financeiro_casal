import { store, firebaseConfigurado, novoId } from "./store.js";
import { PADRAO } from "./config.js";
import { lerPlanilha, adivinharTipo, semAcento, dinheiro } from "./importer.js";

// =====================================================================
// Estado
// =====================================================================
const S = {
  usuario: null,
  ajustes: null,
  despesas: [], cartoes: [], rendas: [], faturas: [],
  mes: localStorage.getItem("fc_mes") || mesHoje(),
  aba: "resumo",
  filtroCartao: "todos",
  periodo: 12,
  graficos: []
};

S.aba = abaValida((location.hash || "#resumo").slice(1));

// "fixas" e "cartoes" eram abas separadas: hoje fazem parte de Despesas
function abaValida(aba) {
  if (aba === "fixas") return "despesas";
  if (aba === "cartoes") { S.filtroDesp = "cartoes"; return "despesas"; }
  return aba || "resumo";
}

const ABAS = [
  { id: "resumo", nome: "Resumo", icone: '<path d="M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z"/>' },
  { id: "despesas", nome: "Despesas", icone: '<path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2zm2 5h6v2H9zm0 4h6v2H9z"/>' },
  { id: "rendas", nome: "Rendas", icone: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 4h-2v1.1A3 3 0 0 0 8.5 10c0 1.9 1.6 2.6 3.1 3 1.2.3 1.9.6 1.9 1.3s-.7 1.2-1.6 1.2c-1 0-1.8-.5-2-1.4H8.1a3.4 3.4 0 0 0 2.9 3V18h2v-1.1c1.6-.3 2.6-1.4 2.6-2.8 0-2-1.7-2.6-3.2-3-1.1-.3-1.8-.5-1.8-1.1 0-.6.6-1 1.4-1 .8 0 1.4.4 1.6 1.1h1.8A3.3 3.3 0 0 0 13 7.1z"/>' },
  { id: "graficos", nome: "Gráficos", icone: '<path d="M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z"/>' },
  { id: "ajustes", nome: "Ajustes", lateral: true, icone: '<path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>' }
];

const CORES = ["#1f6f5c", "#e07a3f", "#3b6fb6", "#c9a227", "#8e5bb5", "#d1495b", "#2a9d8f", "#7a8b3a", "#b5651d", "#5c7cfa", "#9c6644", "#7d8590", "#e76f51", "#4d908e"];

// =====================================================================
// Utilitários
// =====================================================================
function mesHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function somaMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function rotuloMes(mes, curto = false) {
  const [a, m] = mes.split("-").map(Number);
  return curto ? `${NOMES_MES[m - 1].slice(0, 3)}/${String(a).slice(2)}` : `${NOMES_MES[m - 1]} ${a}`;
}
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (v) => BRL.format(v || 0);
const brlCurto = (v) => (Math.abs(v) >= 1000 ? "R$ " + (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : brl(v));
const soma = (lista, f = (x) => x.valor) => lista.reduce((s, x) => s + (Number(f(x)) || 0), 0);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const faturaId = (mes, cartao) => `${mes}__${slug(cartao)}`;
const $ = (sel, raiz = document) => raiz.querySelector(sel);

function aj() {
  const a = S.ajustes || {};
  return {
    cartoes: a.cartoes?.length ? a.cartoes : PADRAO.cartoes,
    pessoas: a.pessoas?.length ? a.pessoas : PADRAO.pessoas,
    categorias: a.categorias?.length ? a.categorias : PADRAO.categorias,
    tipos: a.tipos?.length ? a.tipos : PADRAO.tipos,
    categoriaFaturas: a.categoriaFaturas || "Estilo de vida",
    coresCartoes: a.coresCartoes || {}
  };
}
async function salvarAjustes(parcial) {
  await store.salvarAjustes({ ...aj(), ...(S.ajustes || {}), ...parcial });
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
async function tentar(fn, msgOk) {
  try { await fn(); if (msgOk) toast(msgOk); }
  catch (e) { console.error(e); toast("Erro: " + (e.message || e)); }
}

// =====================================================================
// Cálculos do mês
// =====================================================================
function calcMes(m) {
  const A = aj();
  const fixas = S.despesas.filter((d) => d.mes === m);
  const itens = S.cartoes.filter((c) => c.mes === m);
  const rendas = S.rendas.filter((r) => r.mes === m);
  const fatMes = S.faturas.filter((f) => f.mes === m);

  const nomes = [...A.cartoes];
  for (const x of [...itens, ...fatMes]) if (!nomes.includes(x.cartao)) nomes.push(x.cartao);
  const faturas = nomes.map((nome) => {
    const its = itens.filter((i) => i.cartao === nome).sort((a, b) => (b.valor || 0) - (a.valor || 0));
    const somaItens = soma(its);
    const f = fatMes.find((x) => x.cartao === nome);
    const informado = f && f.valorInformado != null && f.valorInformado !== "" ? Number(f.valorInformado) : null;
    return { nome, itens: its, somaItens, informado, total: informado ?? somaItens, status: f?.status || "Pendente", id: faturaId(m, nome) };
  }).filter((f) => f.itens.length || f.informado != null);

  const totalFixas = soma(fixas);
  const totalCartoes = soma(faturas, (f) => f.total);
  const totalDespesas = totalFixas + totalCartoes;
  const salarios = rendas.filter((r) => r.tipo !== "receber");
  const receber = rendas.filter((r) => r.tipo === "receber");
  const totalRendas = soma(rendas);
  const receberPendente = soma(receber.filter((r) => !r.recebido));

  const porCategoria = A.categorias.map((c) => {
    const real = soma(fixas.filter((d) => d.categoria === c.nome)) + (c.nome === A.categoriaFaturas ? totalCartoes : 0);
    return { nome: c.nome, real, pct: c.ideal, ideal: (totalRendas * (Number(c.ideal) || 0)) / 100 };
  });
  const semCat = soma(fixas.filter((d) => !A.categorias.some((c) => c.nome === d.categoria)));
  if (semCat) porCategoria.push({ nome: "Sem categoria", real: semCat, pct: 0, ideal: 0 });

  const porTipo = {};
  const addTipo = (t, v) => { porTipo[t || "Outros"] = (porTipo[t || "Outros"] || 0) + (Number(v) || 0); };
  fixas.forEach((d) => addTipo(d.tipo, d.valor));
  itens.forEach((i) => addTipo(i.tipo, i.valor));
  faturas.forEach((f) => { if (f.informado != null && f.informado - f.somaItens > 0.009) addTipo("Fatura não detalhada", f.informado - f.somaItens); });

  const porPessoa = {};
  itens.forEach((i) => { porPessoa[i.quem || "Casal"] = (porPessoa[i.quem || "Casal"] || 0) + (Number(i.valor) || 0); });

  return { fixas, itens, faturas, salarios, receber, totalFixas, totalCartoes, totalDespesas, totalRendas, receberPendente, sobra: totalRendas - totalDespesas, porCategoria, porTipo, porPessoa };
}

// =====================================================================
// Renderização
// =====================================================================
function svgIcone(path) { return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">${path}</svg>`; }

function renderNav() {
  const item = (a) => `<button class="nav-item ${S.aba === a.id ? "ativo" : ""}" data-acao="ir" data-aba="${a.id}" ${S.aba === a.id ? 'aria-current="page"' : ""}>${svgIcone(a.icone)}<span>${a.nome}</span></button>`;
  $("#nav").innerHTML = ABAS.map(item).join("");
  $("#nav-inferior").innerHTML = ABAS.filter((a) => !a.lateral).map(item).join("");
  const u = S.usuario;
  $("#usuario-lateral").innerHTML = u ? `${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : ""}<div><strong>${esc(u.nome)}</strong><small>${esc(u.email || "dados neste navegador")}</small></div>` : "";
}

function renderTopo() {
  $("#rotulo-mes").textContent = rotuloMes(S.mes);
  $("#input-mes").value = S.mes;
  $("#fab").hidden = S.aba === "ajustes" || S.aba === "graficos";
  const online = navigator.onLine;
  const st = $("#status-sync");
  if (store.modo === "local") { st.textContent = "Local"; st.className = "status-sync local"; }
  else { st.textContent = online ? "Sincronizado" : "Offline · salvo no aparelho"; st.className = "status-sync " + (online ? "ok" : "off"); }
}

function render() {
  if (!S.usuario) return;
  destruirGraficos();
  renderNav();
  renderTopo();
  const c = calcMes(S.mes);
  const tela = $("#tela");
  const telas = { resumo: telaResumo, despesas: telaDespesas, rendas: telaRendas, graficos: telaGraficos, ajustes: telaAjustes };
  tela.innerHTML = (telas[S.aba] || telaResumo)(c);
  if (S.aba === "graficos") desenharGraficos();
}

// Observação: campo do formulário e linha na lista
const campoObs = (valor) => `<label class="campo"><span>Observação (opcional)</span><textarea name="obs" rows="2" maxlength="500" placeholder="Alguma anotação sobre este lançamento">${esc(valor || "")}</textarea></label>`;
const linhaObs = (o) => (o ? `<small class="obs" title="${esc(o)}">${esc(o)}</small>` : "");

const chipStatus = (status, acao, id) => {
  const cls = { Pago: "pago", Reservado: "reservado", Pendente: "pendente" }[status] || "pendente";
  return `<button class="chip-status ${cls}" data-acao="${acao}" data-id="${esc(id)}" title="Toque para mudar">${esc(status || "Pendente")}</button>`;
};

function vazio(texto, botao = "") {
  return `<div class="vazio"><p>${texto}</p>${botao}</div>`;
}

// ---------- Resumo ----------
function telaResumo(c) {
  const A = aj();
  const barras = c.porCategoria.map((p) => {
    const pct = p.ideal > 0 ? (p.real / p.ideal) * 100 : 0;
    const estouro = p.ideal > 0 && p.real > p.ideal;
    return `<div class="barra-cat">
      <div class="barra-topo"><span>${esc(p.nome)} <small>${p.pct ? `ideal ${p.pct}%` : ""}</small></span><span class="num">${brl(p.real)} <small>/ ${brl(p.ideal)}</small></span></div>
      <div class="trilho"><div class="preench ${estouro ? "estouro" : ""}" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
  }).join("");

  const tipos = Object.entries(c.porTipo).sort((a, b) => b[1] - a[1]);
  const maxTipo = tipos[0]?.[1] || 1;
  const listaTipos = tipos.slice(0, 7).map(([t, v], i) => `<div class="linha-tipo">
      <span class="ponto" style="background:${corTipo(t, i)}"></span><span class="nome">${esc(t)}</span>
      <span class="mini-trilho"><span style="width:${(v / maxTipo) * 100}%;background:${corTipo(t, i)}"></span></span>
      <span class="num">${brl(v)}</span></div>`).join("");

  const faturas = c.faturas.map((f) => `<div class="linha">
      ${iconeCartao(f.nome)}<div class="linha-info" data-acao="ir-cartao" data-cartao="${esc(f.nome)}"><strong>${esc(f.nome)}</strong><small>${f.itens.length} ${f.itens.length === 1 ? "item" : "itens"}</small></div>
      <span class="num">${brl(f.total)}</span>${chipStatus(f.status, "status-fatura", f.nome)}</div>`).join("");

  const pendFixas = c.fixas.filter((d) => d.status === "Pendente");
  const pendRec = c.receber.filter((r) => !r.recebido);
  const temDados = c.fixas.length || c.itens.length || c.salarios.length || c.receber.length || c.faturas.length;

  const anterior = somaMes(S.mes, -1);
  const temAnterior = S.despesas.some((d) => d.mes === anterior) || S.rendas.some((r) => r.mes === anterior && r.tipo !== "receber");
  const semFixasNemSalario = !c.fixas.length && !c.salarios.length;
  const comecar = (!temDados || (semFixasNemSalario && temAnterior)) ? `<div class="cartao destaque-vazio">
      <h3>${temDados ? `Faltam as fixas e salários de ${rotuloMes(S.mes)}` : `${rotuloMes(S.mes)} ainda está vazio`}</h3>
      <p>${temAnterior ? `Traga as despesas fixas e os salários de ${rotuloMes(anterior)} com um toque. As parcelas de cartão já aparecem sozinhas.` : "Comece lançando um salário, uma despesa fixa ou uma compra no cartão — ou importe sua planilha em Ajustes."}</p>
      ${temAnterior ? `<button class="btn btn-primario" data-acao="copiar-mes">Copiar fixas e salários de ${rotuloMes(anterior, true)}</button>` : `<button class="btn btn-primario" data-acao="ir" data-aba="ajustes">Importar planilha</button>`}
    </div>` : "";

  return `
  ${comecar}
  <div class="kpis">
    <div class="kpi"><span>Rendas</span><strong class="num">${brl(c.totalRendas)}</strong><small>${c.receberPendente ? `${brl(c.receberPendente)} ainda a receber` : "&nbsp;"}</small></div>
    <div class="kpi"><span>Despesas</span><strong class="num">${brl(c.totalDespesas)}</strong><small>Contas ${brlCurto(c.totalFixas)} · Cartões ${brlCurto(c.totalCartoes)}</small></div>
    <div class="kpi ${c.sobra < 0 ? "negativo" : "positivo"}"><span>${c.sobra < 0 ? "Faltou" : "Sobra"}</span><strong class="num">${brl(Math.abs(c.sobra))}</strong><small>${c.totalRendas ? Math.round((c.sobra / c.totalRendas) * 100) + "% da renda" : "&nbsp;"}</small></div>
  </div>

  <div class="grade-2">
    <div class="cartao"><div class="cartao-titulo"><h3>Real × ideal por categoria</h3><small>faturas contam em "${esc(A.categoriaFaturas)}"</small></div>${barras || vazio("Sem dados")}</div>
    <div class="cartao"><div class="cartao-titulo"><h3>Por tipo de gasto</h3><button class="link" data-acao="ir" data-aba="graficos">ver gráficos</button></div>${listaTipos || vazio("Nenhum gasto lançado")}</div>
  </div>

  <div class="grade-2">
    <div class="cartao"><div class="cartao-titulo"><h3>Faturas do mês</h3><span class="num">${brl(c.totalCartoes)}</span></div>${faturas || vazio("Nenhuma compra no cartão neste mês")}</div>
    <div class="cartao"><div class="cartao-titulo"><h3>Pendências</h3></div>
      ${pendFixas.length ? `<div class="linha"><div class="linha-info" data-acao="ir" data-aba="despesas"><strong>${pendFixas.length} despesa${pendFixas.length > 1 ? "s" : ""} pendente${pendFixas.length > 1 ? "s" : ""}</strong><small>${esc(pendFixas.slice(0, 3).map((d) => d.descricao).join(", "))}${pendFixas.length > 3 ? "…" : ""}</small></div><span class="num">${brl(soma(pendFixas))}</span></div>` : ""}
      ${pendRec.map((r) => `<div class="linha"><div class="linha-info" data-acao="editar-renda" data-id="${r.id}"><strong>A receber: ${esc(r.descricao)}</strong><small>${esc(r.obs || "")}</small></div><span class="num">${brl(r.valor)}</span></div>`).join("")}
      ${!pendFixas.length && !pendRec.length ? vazio("Nada pendente 🎉") : ""}
    </div>
  </div>`;
}

const mapaCorTipo = {};
function corTipo(t, i = 0) {
  if (t === "Fatura não detalhada") return "#9aa3a0";
  const idx = aj().tipos.indexOf(t);
  if (idx >= 0) return CORES[idx % CORES.length];
  if (!mapaCorTipo[t]) mapaCorTipo[t] = CORES[(Object.keys(mapaCorTipo).length + 5 + i) % CORES.length];
  return mapaCorTipo[t];
}
// Ícone genérico de cartão (sem marca de banco) na cor escolhida para cada cartão
function iconeCartao(nome, classe = "") {
  const cor = corCartao(nome);
  return `<svg class="icone-cartao ${classe}" viewBox="0 0 32 22" aria-hidden="true"><rect width="32" height="22" rx="4" fill="${cor}"/><rect x="4" y="7" width="7" height="5.5" rx="1.2" fill="#fff" opacity=".85"/><rect x="4" y="16" width="14" height="2" rx="1" fill="#fff" opacity=".55"/><circle cx="24" cy="16.5" r="2.6" fill="#fff" opacity=".45"/><circle cx="27" cy="16.5" r="2.6" fill="#fff" opacity=".3"/></svg>`;
}
function corCartao(nome) {
  const escolhida = aj().coresCartoes[nome];
  if (escolhida) return escolhida;
  const lista = aj().cartoes;
  const i = lista.indexOf(nome);
  return CORES[(i >= 0 ? i : lista.length + nome.length) % CORES.length];
}

// ---------- Despesas fixas ----------
function telaDespesas(c) {
  const A = aj();
  const anterior = somaMes(S.mes, -1);
  const qtdAnterior = S.despesas.filter((d) => d.mes === anterior && d.recorrente !== false).length;
  const ehFixa = (d) => d.recorrente !== false;
  const filtro = S.filtroDesp || "todas";
  const visiveis = filtro === "cartoes" ? [] : c.fixas.filter((d) => filtro === "todas" || (filtro === "fixas" ? ehFixa(d) : !ehFixa(d)));
  const cats = [...A.categorias.map((x) => x.nome)];
  c.fixas.forEach((d) => { if (!cats.includes(d.categoria)) cats.push(d.categoria); });

  const grupos = cats.map((cat) => {
    const itens = visiveis.filter((d) => d.categoria === cat).sort((a, b) => (ehFixa(b) - ehFixa(a)) || ((b.valor || 0) - (a.valor || 0)));
    const extra = filtro === "todas" && cat === A.categoriaFaturas && c.totalCartoes ? `<div class="linha sutil"><div class="linha-info" data-acao="rolar-cartoes"><strong>Faturas de cartão</strong><small>detalhadas mais abaixo, em Cartões</small></div><span class="num">${brl(c.totalCartoes)}</span></div>` : "";
    if (!itens.length && !extra) return "";
    return `<div class="cartao">
      <div class="cartao-titulo"><h3>${esc(cat || "Sem categoria")}</h3><span class="num">${brl(soma(itens) + (extra ? c.totalCartoes : 0))}</span></div>
      ${itens.map((d) => `<div class="linha">
        ${chipStatus(d.status, "status-fixa", d.id)}
        <div class="linha-info" data-acao="editar-fixa" data-id="${d.id}"><strong>${esc(d.descricao)}</strong><small>${esc(d.tipo || "")}${d.parcelas ? ` · parcela ${esc(d.parcelas)}` : ""}</small>${linhaObs(d.obs)}</div>
        <button class="tag-fixa ${ehFixa(d) ? "on" : ""}" data-acao="toggle-fixa" data-id="${d.id}" title="${ehFixa(d) ? "Fixa: repete todo mês. Toque para tornar avulsa" : "Avulsa: só este mês. Toque para tornar fixa"}">${ehFixa(d) ? "Fixa" : "Avulsa"}</button>
        <span class="num">${brl(d.valor)}</span></div>`).join("")}
      ${extra}
    </div>`;
  }).join("");

  const totFixas = soma(c.fixas.filter(ehFixa)), totAvulsas = soma(c.fixas.filter((d) => !ehFixa(d)));
  const pagos = soma(c.fixas.filter((d) => d.status === "Pago"));
  const chipF = (id, nome, v) => `<button class="chip ${filtro === id ? "ativo" : ""}" data-acao="filtro-desp" data-f="${id}">${nome} <b>${brlCurto(v)}</b></button>`;
  const contas = grupos || vazio(filtro === "todas" ? `Nenhuma conta lançada em ${rotuloMes(S.mes)}.` : `Nenhuma despesa ${filtro === "fixas" ? "fixa" : "avulsa"} em ${rotuloMes(S.mes)}.`, qtdAnterior && filtro !== "avulsas" ? `<button class="btn btn-primario" data-acao="copiar-fixas">Copiar ${qtdAnterior} despesas fixas de ${rotuloMes(anterior, true)}</button>` : "");
  return `
  <div class="cabecalho-tela">
    <div><h2>Despesas</h2><p class="sub">${brl(c.totalDespesas)} no mês · contas ${brl(c.totalFixas)} · cartões ${brl(c.totalCartoes)}</p></div>
    <div class="acoes">
      ${qtdAnterior && filtro !== "cartoes" ? `<button class="btn" data-acao="copiar-fixas">Copiar fixas de ${rotuloMes(anterior, true)}</button>` : ""}
      <button class="btn" data-acao="nova-fixa" data-fixa="0">+ Avulsa</button>
      <button class="btn" data-acao="nova-fixa" data-fixa="1">+ Fixa</button>
      <button class="btn btn-primario" data-acao="novo-cartao">+ Cartão</button>
    </div>
  </div>
  <div class="chips rolagem">${chipF("todas", "Todas", c.totalDespesas)}${chipF("fixas", "Fixas", totFixas)}${chipF("avulsas", "Avulsas", totAvulsas)}${chipF("cartoes", "Cartões", c.totalCartoes)}</div>
  ${filtro !== "cartoes" ? `<p class="dica"><b>Fixa</b> repete todo mês (entra no "copiar fixas"); <b>avulsa</b> é só deste mês. Toque na etiqueta para trocar, e no status para alternar <b>Pendente → Pago → Reservado</b>.</p>
  ${contas}` : ""}
  ${filtro === "todas" || filtro === "cartoes" ? secaoCartoes(c, filtro === "cartoes") : ""}`;
}

// ---------- Cartões ----------
function secaoCartoes(c, sozinha) {
  const filtro = S.filtroCartao;
  const chips = [`<button class="chip ${filtro === "todos" ? "ativo" : ""}" data-acao="filtro-cartao" data-cartao="todos">Todos <b>${brlCurto(c.totalCartoes)}</b></button>`]
    .concat(c.faturas.map((f) => `<button class="chip ${filtro === f.nome ? "ativo" : ""}" data-acao="filtro-cartao" data-cartao="${esc(f.nome)}">${iconeCartao(f.nome, "mini")}${esc(f.nome)} <b>${brlCurto(f.total)}</b></button>`)).join("");

  const pessoas = Object.entries(c.porPessoa).sort((a, b) => b[1] - a[1]).map(([p, v]) => `<span class="pill">${esc(p)}: <b class="num">${brl(v)}</b></span>`).join("");

  const blocos = c.faturas.filter((f) => filtro === "todos" || f.nome === filtro).map((f) => {
    const dif = f.informado != null ? f.informado - f.somaItens : 0;
    return `<div class="cartao">
      <div class="cartao-titulo cartao-fatura">
        <h3>${iconeCartao(f.nome, "grande")}${esc(f.nome)}</h3>
        <div class="fatura-dir"><span class="num grande">${brl(f.total)}</span>${chipStatus(f.status, "status-fatura", f.nome)}</div>
      </div>
      <div class="fatura-info">
        <span>Itens: <b class="num">${brl(f.somaItens)}</b></span>
        ${f.informado != null ? `<span>Fatura informada: <b class="num">${brl(f.informado)}</b>${Math.abs(dif) > 0.009 ? ` <em class="${dif > 0 ? "aviso-txt" : ""}">(${dif > 0 ? brl(dif) + " não detalhado" : brl(-dif) + " a mais nos itens"})</em>` : ""}</span>` : ""}
        <button class="link" data-acao="editar-fatura" data-cartao="${esc(f.nome)}">${f.informado != null ? "editar valor da fatura" : "informar valor da fatura"}</button>
      </div>
      ${f.itens.map((i) => `<div class="linha">
        <div class="linha-info" data-acao="editar-cartao" data-id="${i.id}"><strong>${esc(i.descricao)}</strong>
          <small>${(i.parcelaTotal || 1) > 1 ? `<span class="parc">${i.parcelaAtual}/${i.parcelaTotal}</span> ` : ""}${esc(i.tipo || "")} · ${esc(i.quem || "Casal")}</small>${linhaObs(i.obs)}</div>
        <span class="num">${brl(i.valor)}</span></div>`).join("") || `<p class="sub">Sem itens detalhados.</p>`}
    </div>`;
  }).join("");

  return `
  <div class="secao-titulo ${sozinha ? "sem-borda" : ""}" id="secao-cartoes">
    <div><h2>Cartões</h2><p class="sub">${brl(c.totalCartoes)} em faturas · ${c.itens.length} lançamentos</p></div>
    <button class="btn" data-acao="novo-cartao">+ Compra no cartão</button>
  </div>
  <div class="chips rolagem">${chips}</div>
  ${pessoas ? `<div class="pills">${pessoas}</div>` : ""}
  ${blocos || vazio(`Nenhuma compra no cartão em ${rotuloMes(S.mes)}.`, `<button class="btn btn-primario" data-acao="novo-cartao">Lançar compra</button>`)}`;
}

// ---------- Rendas ----------
function telaRendas(c) {
  const anterior = somaMes(S.mes, -1);
  const salAnt = S.rendas.filter((r) => r.mes === anterior && r.tipo !== "receber").length;
  return `
  <div class="cabecalho-tela">
    <div><h2>Rendas</h2><p class="sub">${brl(c.totalRendas)} no mês</p></div>
    <div class="acoes">
      <button class="btn" data-acao="nova-renda" data-tipo="receber">+ A receber</button>
      <button class="btn btn-primario" data-acao="nova-renda" data-tipo="salario">+ Salário</button>
    </div>
  </div>
  <div class="grade-2">
    <div class="cartao">
      <div class="cartao-titulo"><h3>Salários e entradas</h3><span class="num">${brl(soma(c.salarios))}</span></div>
      ${c.salarios.map((r) => `<div class="linha"><div class="linha-info" data-acao="editar-renda" data-id="${r.id}"><strong>${esc(r.descricao)}</strong><small>${esc(r.pessoa || "")}</small>${linhaObs(r.obs)}</div><span class="num">${brl(r.valor)}</span></div>`).join("")
        || vazio("Nenhum salário lançado.", salAnt ? `<button class="btn" data-acao="copiar-salarios">Copiar de ${rotuloMes(anterior, true)}</button>` : "")}
    </div>
    <div class="cartao">
      <div class="cartao-titulo"><h3>A receber de alguém</h3><span class="num">${brl(soma(c.receber))}</span></div>
      ${c.receber.length ? `<p class="dica">Marque quando o dinheiro entrar. Pendente: <b class="num">${brl(c.receberPendente)}</b></p>` : ""}
      ${c.receber.map((r) => `<div class="linha">
        <button class="check ${r.recebido ? "on" : ""}" data-acao="toggle-recebido" data-id="${r.id}" aria-label="${r.recebido ? "Recebido" : "Marcar como recebido"}">${r.recebido ? "✓" : ""}</button>
        <div class="linha-info" data-acao="editar-renda" data-id="${r.id}"><strong class="${r.recebido ? "riscado" : ""}">${esc(r.descricao)}</strong><small>${r.recebido ? "recebido" : "pendente"}</small>${linhaObs(r.obs)}</div>
        <span class="num">${brl(r.valor)}</span></div>`).join("") || vazio("Ninguém te deve nada este mês.")}
    </div>
  </div>`;
}

// ---------- Gráficos ----------
function telaGraficos() {
  const per = [[6, "6 meses"], [12, "12 meses"], [24, "24 meses"], [0, "Tudo"]];
  return `
  <div class="cabecalho-tela"><div><h2>Gráficos</h2><p class="sub">Até ${rotuloMes(S.mes)}</p></div></div>
  <div class="chips">${per.map(([n, r]) => `<button class="chip ${S.periodo === n ? "ativo" : ""}" data-acao="periodo" data-n="${n}">${r}</button>`).join("")}</div>
  <div id="sem-chart" class="aviso" hidden>Não foi possível carregar a biblioteca de gráficos (sem internet?). Os resumos em texto continuam no Resumo.</div>
  <div class="grade-2">
    <div class="cartao"><div class="cartao-titulo"><h3>Por tipo de gasto · ${rotuloMes(S.mes)}</h3></div><div class="caixa-grafico"><canvas id="g-tipo-mes"></canvas></div></div>
    <div class="cartao"><div class="cartao-titulo"><h3>Real × ideal por categoria</h3></div><div class="caixa-grafico"><canvas id="g-categorias"></canvas></div></div>
  </div>
  <div class="cartao"><div class="cartao-titulo"><h3>Fatura por cartão ao longo do tempo</h3></div><div class="caixa-grafico alto"><canvas id="g-cartao-tempo"></canvas></div></div>
  <div class="cartao"><div class="cartao-titulo"><h3>Tipos de gasto ao longo do tempo</h3></div><div class="caixa-grafico alto"><canvas id="g-tipo-tempo"></canvas></div></div>
  <div class="cartao"><div class="cartao-titulo"><h3>Rendas × despesas</h3></div><div class="caixa-grafico alto"><canvas id="g-renda-desp"></canvas></div></div>`;
}

let chartPromessa;
function carregarChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  chartPromessa ||= new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    s.onload = () => ok(window.Chart);
    s.onerror = () => { chartPromessa = null; erro(new Error("Chart.js indisponível")); };
    document.head.appendChild(s);
  });
  return chartPromessa;
}
function destruirGraficos() { S.graficos.forEach((g) => g.destroy()); S.graficos = []; }

function mesesDoPeriodo() {
  let inicio;
  if (S.periodo > 0) inicio = somaMes(S.mes, -(S.periodo - 1));
  else {
    const todos = [...S.despesas, ...S.cartoes, ...S.rendas, ...S.faturas].map((x) => x.mes).filter(Boolean).sort();
    inicio = todos[0] && todos[0] < S.mes ? todos[0] : somaMes(S.mes, -11);
  }
  const meses = [];
  for (let m = inicio; m <= S.mes; m = somaMes(m, 1)) meses.push(m);
  return meses;
}

async function desenharGraficos() {
  let Chart;
  try { Chart = await carregarChart(); } catch { const a = $("#sem-chart"); if (a) a.hidden = false; return; }
  if (S.aba !== "graficos") return;
  destruirGraficos();
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue("--texto-2").trim();
  Chart.defaults.borderColor = css.getPropertyValue("--linha").trim();
  Chart.defaults.font.family = css.getPropertyValue("--fonte").trim();
  const moeda = { callback: (v) => brlCurto(v) };
  const tooltipBRL = { callbacks: { label: (ctx) => `${ctx.dataset.label || ctx.label}: ${brl(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}` } };
  const novo = (id, cfg) => { const el = document.getElementById(id); if (el) S.graficos.push(new Chart(el, cfg)); };

  const c = calcMes(S.mes);
  const tipos = Object.entries(c.porTipo).sort((a, b) => b[1] - a[1]);
  novo("g-tipo-mes", {
    type: "doughnut",
    data: { labels: tipos.map((t) => t[0]), datasets: [{ data: tipos.map((t) => t[1]), backgroundColor: tipos.map((t, i) => corTipo(t[0], i)), borderWidth: 2, borderColor: css.getPropertyValue("--superficie").trim() }] },
    options: { maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "right", labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${brl(ctx.parsed)}` } } } }
  });

  novo("g-categorias", {
    type: "bar",
    data: {
      labels: c.porCategoria.map((p) => p.nome),
      datasets: [
        { label: "Real", data: c.porCategoria.map((p) => p.real), backgroundColor: "#1f6f5c", borderRadius: 6 },
        { label: "Ideal", data: c.porCategoria.map((p) => p.ideal), backgroundColor: "rgba(150,160,155,.45)", borderRadius: 6 }
      ]
    },
    options: { maintainAspectRatio: false, indexAxis: "y", scales: { x: { ticks: moeda } }, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${brl(ctx.parsed.x)}` } } } }
  });

  const meses = mesesDoPeriodo();
  const calcs = meses.map(calcMes);
  const labels = meses.map((m) => rotuloMes(m, true));

  const cartoesUsados = [...new Set(calcs.flatMap((k) => k.faturas.map((f) => f.nome)))];
  novo("g-cartao-tempo", {
    type: "bar",
    data: { labels, datasets: cartoesUsados.map((nome) => ({ label: nome, data: calcs.map((k) => k.faturas.find((f) => f.nome === nome)?.total || 0), backgroundColor: corCartao(nome), borderRadius: 3 })) },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: moeda } }, plugins: { tooltip: { ...tooltipBRL, mode: "index" } } }
  });

  const totTipo = {};
  calcs.forEach((k) => Object.entries(k.porTipo).forEach(([t, v]) => (totTipo[t] = (totTipo[t] || 0) + v)));
  const tiposTempo = Object.keys(totTipo).sort((a, b) => totTipo[b] - totTipo[a]);
  novo("g-tipo-tempo", {
    type: "bar",
    data: { labels, datasets: tiposTempo.map((t, i) => ({ label: t, data: calcs.map((k) => k.porTipo[t] || 0), backgroundColor: corTipo(t, i), borderRadius: 3 })) },
    options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: moeda } }, plugins: { tooltip: { ...tooltipBRL, mode: "index" } } }
  });

  novo("g-renda-desp", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Rendas", data: calcs.map((k) => k.totalRendas), backgroundColor: "#2a9d8f", borderRadius: 4 },
        { type: "bar", label: "Despesas", data: calcs.map((k) => k.totalDespesas), backgroundColor: "#e07a3f", borderRadius: 4 },
        { type: "line", label: "Sobra", data: calcs.map((k) => k.sobra), borderColor: css.getPropertyValue("--texto").trim(), backgroundColor: css.getPropertyValue("--texto").trim(), tension: 0.3, pointRadius: 3 }
      ]
    },
    options: { maintainAspectRatio: false, scales: { y: { ticks: moeda } }, plugins: { tooltip: { ...tooltipBRL, mode: "index" } } }
  });
}

// ---------- Ajustes ----------
function telaAjustes() {
  const A = aj();
  const lista = (chave, titulo, dica) => `<div class="cartao">
    <div class="cartao-titulo"><h3>${titulo}</h3></div>
    ${dica ? `<p class="dica">${dica}</p>` : ""}
    ${chave === "cartoes" ? `<p class="dica">Toque no cartão colorido para escolher a cor de cada um.</p>` : ""}
    <div class="chips quebra">${A[chave].map((x) => `<span class="chip fixo">${chave === "cartoes" ? `<label class="seletor-cor" title="Mudar cor">${iconeCartao(x, "mini")}<input type="color" class="cor-cartao" data-cartao="${esc(x)}" value="${corCartao(x)}"></label>` : ""}${esc(x)}<button data-acao="remover-lista" data-lista="${chave}" data-valor="${esc(x)}" aria-label="Remover ${esc(x)}">×</button></span>`).join("")}</div>
    <div class="linha-add"><input type="text" id="add-${chave}" placeholder="Adicionar…" enterkeyhint="done"><button class="btn" data-acao="add-lista" data-lista="${chave}">Adicionar</button></div>
  </div>`;
  const u = S.usuario;
  return `
  <div class="cabecalho-tela"><div><h2>Ajustes</h2></div></div>
  <div class="cartao conta">
    ${u?.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : ""}
    <div><strong>${esc(u?.nome || "")}</strong><small>${store.modo === "local" ? "Modo local — sem sincronização" : esc(u?.email || "")}</small></div>
    ${store.modo !== "local" ? `<button class="btn" data-acao="sair">Sair</button>` : ""}
  </div>

  <div class="cartao">
    <div class="cartao-titulo"><h3>Importar a planilha do Google</h3></div>
    <p class="dica">No Google Sheets: <b>Arquivo → Fazer download → Microsoft Excel (.xlsx)</b>. Depois escolha o arquivo aqui. Cada aba "Mês.AA" vira um mês (abas como "Empréstimo" e "… Original" são ignoradas). Os meses importados substituem o que já existir nesses meses.</p>
    <label class="btn btn-primario arquivo">Escolher arquivo .xlsx<input type="file" id="arquivo-xlsx" accept=".xlsx,.xls,.ods" hidden></label>
  </div>

  <div class="grade-2">${lista("cartoes", "Cartões")}${lista("tipos", "Tipos de gasto", "Usados nos gráficos. O app sugere o tipo pelo nome da compra.")}</div>
  <div class="grade-2">
    ${lista("pessoas", "Pessoas", "Quem fez a compra no cartão.")}
    <div class="cartao">
      <div class="cartao-titulo"><h3>Categorias e % ideal da renda</h3></div>
      ${A.categorias.map((c, i) => `<div class="linha-cat"><input type="text" value="${esc(c.nome)}" data-cat-nome="${i}" aria-label="Nome da categoria"><input type="number" min="0" max="100" value="${esc(c.ideal)}" data-cat-ideal="${i}" aria-label="% ideal"><span>%</span></div>`).join("")}
      <label class="campo"><span>Faturas de cartão contam como</span><select id="cat-faturas">${A.categorias.map((c) => `<option ${c.nome === A.categoriaFaturas ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
      <button class="btn" data-acao="salvar-categorias">Salvar categorias</button>
    </div>
  </div>

  <div class="cartao">
    <div class="cartao-titulo"><h3>Backup</h3></div>
    <p class="dica">Baixe uma cópia de tudo em JSON (bom para guardar de vez em quando) ou restaure um backup.</p>
    <div class="acoes"><button class="btn" data-acao="exportar">Baixar backup</button>
    <label class="btn arquivo">Restaurar backup<input type="file" id="arquivo-backup" accept=".json" hidden></label></div>
  </div>
  <p class="rodape">Finanças do Casal · ${store.modo === "local" ? "modo local" : "sincronizado com Firebase"}</p>`;
}

// =====================================================================
// Formulários (modal)
// =====================================================================
const modal = () => $("#modal");
function abrirModal(html, aoSalvar, aoAbrir) {
  const form = $("#modal-form");
  form.innerHTML = html;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    if (btn && btn.value === "cancelar") return modal().close();
    const dados = Object.fromEntries(new FormData(form).entries());
    const ok = await aoSalvar(dados, btn?.value, form);
    if (ok !== false) modal().close();
  };
  modal().showModal();
  aoAbrir?.(form);
  const primeiro = form.querySelector("input:not([type=hidden]):not([type=checkbox]),select");
  if (primeiro && !matchMedia("(pointer:coarse)").matches) primeiro.focus();
}
const opcoes = (lista, sel) => lista.map((x) => `<option ${x === sel ? "selected" : ""}>${esc(x)}</option>`).join("");
const valorBR = (v) => (v === null || v === undefined || v === "" ? "" : Number(v).toFixed(2).replace(".", ","));
function rodapeModal(podeExcluir) {
  return `<div class="modal-acoes">
    ${podeExcluir ? `<button class="btn perigo" value="excluir" formnovalidate>Excluir</button>` : "<span></span>"}
    <div><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn btn-primario" value="salvar">Salvar</button></div>
  </div>`;
}
function lerValor(form, nome = "valor") {
  const v = dinheiro(form.querySelector(`[name=${nome}]`).value);
  if (v === null) { toast("Informe um valor válido"); form.querySelector(`[name=${nome}]`).focus(); return null; }
  return v;
}
// Sugere o tipo pela descrição enquanto a pessoa não escolher manualmente
function ligarSugestaoTipo(form) {
  const desc = form.querySelector("[name=descricao]");
  const tipo = form.querySelector("[name=tipo]");
  if (!desc || !tipo) return;
  let manual = Boolean(desc.value);
  tipo.addEventListener("change", () => (manual = true));
  desc.addEventListener("input", () => {
    if (manual) return;
    const t = adivinharTipo(desc.value);
    if (t !== "Outros" && [...tipo.options].some((o) => o.value === t)) tipo.value = t;
  });
}

function escolherNovo() {
  const html = `<h2>Novo lançamento</h2>
  <div class="escolhas">
    <button class="escolha" value="cartao" formnovalidate><b>Compra no cartão</b><small>à vista ou parcelada</small></button>
    <button class="escolha" value="fixa" formnovalidate><b>Despesa fixa</b><small>aluguel, água, empréstimo…</small></button>
    <button class="escolha" value="avulsa" formnovalidate><b>Despesa avulsa</b><small>só deste mês, fora do cartão</small></button>
    <button class="escolha" value="salario" formnovalidate><b>Salário / entrada</b><small>renda do mês</small></button>
    <button class="escolha" value="receber" formnovalidate><b>A receber</b><small>alguém vai te pagar</small></button>
  </div>
  <div class="modal-acoes"><span></span><button class="btn" value="cancelar" formnovalidate>Cancelar</button></div>`;
  abrirModal(html, (_, v) => {
    modal().close();
    setTimeout(() => {
      if (v === "cartao") formCartao();
      else if (v === "fixa") formFixa(null, true);
      else if (v === "avulsa") formFixa(null, false);
      else if (v === "salario" || v === "receber") formRenda(null, v);
    }, 50);
    return false;
  });
}

function escolherDespesa() {
  const html = `<h2>Nova despesa</h2>
  <div class="escolhas">
    <button class="escolha" value="cartao" formnovalidate><b>Compra no cartão</b><small>à vista ou parcelada</small></button>
    <button class="escolha" value="avulsa" formnovalidate><b>Despesa avulsa</b><small>só deste mês, fora do cartão</small></button>
    <button class="escolha" value="fixa" formnovalidate><b>Despesa fixa</b><small>aluguel, água, empréstimo…</small></button>
  </div>
  <div class="modal-acoes"><span></span><button class="btn" value="cancelar" formnovalidate>Cancelar</button></div>`;
  abrirModal(html, (_, v) => {
    modal().close();
    setTimeout(() => { if (v === "cartao") formCartao(); else if (v === "fixa") formFixa(null, true); else if (v === "avulsa") formFixa(null, false); }, 50);
    return false;
  });
}

// ---------- Compra no cartão ----------
function formCartao(item) {
  const A = aj();
  const novoItem = !item;
  const i = item || { cartao: S.filtroCartao !== "todos" ? S.filtroCartao : A.cartoes[0], quem: "Casal", tipo: "Outros", parcelaAtual: 1, parcelaTotal: 1 };
  const temGrupo = item?.grupo && S.cartoes.filter((x) => x.grupo === item.grupo).length > 1;
  const html = `<h2>${novoItem ? "Compra no cartão" : "Editar compra"}</h2>
  <label class="campo"><span>O que foi</span><input name="descricao" required value="${esc(i.descricao || "")}" placeholder="ex.: mercado, passagem, ração" autocomplete="off"></label>
  <div class="dupla">
    <label class="campo"><span>${novoItem ? "Valor" : "Valor desta parcela"}</span><input name="valor" inputmode="decimal" required value="${valorBR(i.valor)}" placeholder="0,00"></label>
    ${novoItem ? `<label class="campo"><span>O valor é</span><select name="modoValor"><option value="parcela">da parcela</option><option value="total">total da compra</option></select></label>` : `<label class="campo"><span>Parcela</span><input value="${i.parcelaAtual}/${i.parcelaTotal}" disabled></label>`}
  </div>
  ${novoItem ? `<div class="dupla">
    <label class="campo"><span>Nº de parcelas</span><input name="parcelaTotal" type="number" min="1" max="72" value="1" inputmode="numeric"></label>
    <label class="campo"><span>Parcela deste mês</span><input name="parcelaAtual" type="number" min="1" max="72" value="1" inputmode="numeric"></label>
  </div>
  <p class="dica pequena">Parcelada? O app lança as próximas parcelas nos meses seguintes. Se a compra já está em andamento (ex.: parcela 3 de 10), coloque 3 em "Parcela deste mês".</p>` : ""}
  <label class="campo"><span>Cartão</span><select name="cartao">${opcoes(A.cartoes.includes(i.cartao) ? A.cartoes : [...A.cartoes, i.cartao], i.cartao)}</select></label>
  <div class="dupla">
    <label class="campo"><span>Tipo de gasto</span><select name="tipo">${opcoes(A.tipos.includes(i.tipo) ? A.tipos : [...A.tipos, i.tipo], i.tipo)}</select></label>
    <label class="campo"><span>Quem</span><select name="quem">${opcoes(A.pessoas, i.quem)}</select></label>
  </div>
  ${campoObs(i.obs)}
  ${temGrupo ? `<label class="check-linha"><input type="checkbox" name="todas" checked> Aplicar nas próximas parcelas também (nome, cartão, tipo, quem e valor)</label>` : ""}
  ${rodapeModal(!novoItem)}`;

  abrirModal(html, async (d, botao, form) => {
    if (botao === "excluir") return excluirCartao(item);
    if (!d.descricao.trim()) { toast("Diga o que foi a compra"); return false; }
    let valor = lerValor(form); if (valor === null) return false;
    const base = { descricao: d.descricao.trim(), cartao: d.cartao, tipo: d.tipo, quem: d.quem };
    if (novoItem) {
      const total = Math.max(1, parseInt(d.parcelaTotal, 10) || 1);
      const atual = Math.min(total, Math.max(1, parseInt(d.parcelaAtual, 10) || 1));
      if (d.modoValor === "total") valor = Math.round((valor / total) * 100) / 100;
      const grupo = total > 1 ? novoId() : null;
      const ops = [];
      for (let p = atual; p <= total; p++) {
        ops.push({ tipo: "add", col: "cartoes", dados: { ...base, valor, obs: d.obs.trim(), mes: somaMes(S.mes, p - atual), parcelaAtual: p, parcelaTotal: total, grupo } });
      }
      await tentar(() => store.lote(ops), total > atual ? `Lançado em ${ops.length} meses` : "Compra lançada");
    } else {
      const alvo = d.todas && item.grupo ? S.cartoes.filter((x) => x.grupo === item.grupo && x.parcelaAtual >= item.parcelaAtual) : [item];
      // a observação vale só para a parcela que está sendo editada
      await tentar(() => store.lote(alvo.map((x) => ({ tipo: "update", col: "cartoes", id: x.id, dados: x.id === item.id ? { ...base, valor, obs: d.obs.trim() } : { ...base, valor } }))), "Compra atualizada");
    }
  }, ligarSugestaoTipo);
}

function excluirCartao(item) {
  const proximas = item.grupo ? S.cartoes.filter((x) => x.grupo === item.grupo && x.parcelaAtual > item.parcelaAtual) : [];
  if (!proximas.length) {
    if (!confirm(`Excluir "${item.descricao}"?`)) return false;
    tentar(() => store.remover("cartoes", item.id), "Excluído");
    return;
  }
  const html = `<h2>Excluir parcela</h2><p>"${esc(item.descricao)}" tem mais ${proximas.length} parcela(s) depois desta.</p>
  <div class="escolhas"><button class="escolha" value="uma" formnovalidate><b>Só esta parcela</b></button>
  <button class="escolha" value="todas" formnovalidate><b>Esta e as próximas</b><small>${proximas.length + 1} lançamentos</small></button></div>
  <div class="modal-acoes"><span></span><button class="btn" value="cancelar" formnovalidate>Cancelar</button></div>`;
  setTimeout(() => abrirModal(html, async (_, v) => {
    const ids = v === "todas" ? [item, ...proximas].map((x) => x.id) : [item.id];
    await tentar(() => store.lote(ids.map((id) => ({ tipo: "delete", col: "cartoes", id }))), "Excluído");
  }), 50);
}

// ---------- Fatura informada ----------
function formFatura(nome) {
  const f = calcMes(S.mes).faturas.find((x) => x.nome === nome) || { informado: null, somaItens: 0, status: "Pendente" };
  const html = `<h2>Fatura ${esc(nome)} · ${rotuloMes(S.mes, true)}</h2>
  <p class="dica">Soma dos itens lançados: <b class="num">${brl(f.somaItens)}</b>. Se a fatura do banco veio diferente (compras não detalhadas), informe o valor real — ele passa a valer nos totais.</p>
  <label class="campo"><span>Valor da fatura (deixe em branco para usar a soma dos itens)</span><input name="valor" inputmode="decimal" value="${valorBR(f.informado)}" placeholder="${valorBR(f.somaItens)}"></label>
  <label class="campo"><span>Status</span><select name="status">${opcoes(["Pendente", "Pago"], f.status)}</select></label>
  ${rodapeModal(false)}`;
  abrirModal(html, async (d) => {
    const v = d.valor.trim() ? dinheiro(d.valor) : null;
    if (d.valor.trim() && v === null) { toast("Valor inválido"); return false; }
    await tentar(() => store.definir("faturas", faturaId(S.mes, nome), { mes: S.mes, cartao: nome, valorInformado: v, status: d.status }), "Fatura atualizada");
  });
}

// ---------- Despesa fixa ----------
function formFixa(item, fixaInicial = true) {
  const A = aj();
  const novoItem = !item;
  const catAvulsa = A.categorias.find((c) => c.nome === "Estilo de vida")?.nome || A.categorias[0].nome;
  const i = item || (fixaInicial
    ? { categoria: A.categorias[0].nome, status: "Pendente", tipo: "Casa", recorrente: true }
    : { categoria: catAvulsa, status: "Pago", tipo: "Outros", recorrente: false });
  const cats = A.categorias.map((c) => c.nome);
  const html = `<h2>${novoItem ? "Nova despesa" : "Editar despesa"}</h2>
  <div class="segmentado" role="radiogroup" aria-label="Tipo de despesa">
    <label><input type="radio" name="frequencia" value="fixa" ${i.recorrente !== false ? "checked" : ""}><span><b>Fixa</b><small>repete todo mês</small></span></label>
    <label><input type="radio" name="frequencia" value="avulsa" ${i.recorrente === false ? "checked" : ""}><span><b>Avulsa</b><small>só neste mês</small></span></label>
  </div>
  <label class="campo"><span>Despesa</span><input name="descricao" required value="${esc(i.descricao || "")}" placeholder="${i.recorrente === false ? "ex.: conserto, presente, farmácia" : "ex.: aluguel, água, empréstimo carro"}" autocomplete="off"></label>
  <div class="dupla">
    <label class="campo"><span>Valor</span><input name="valor" inputmode="decimal" required value="${valorBR(i.valor)}" placeholder="0,00"></label>
    <label class="campo"><span>Status</span><select name="status">${opcoes(["Pendente", "Pago", "Reservado"], i.status)}</select></label>
  </div>
  <div class="dupla">
    <label class="campo"><span>Categoria</span><select name="categoria">${opcoes(cats.includes(i.categoria) ? cats : [...cats, i.categoria], i.categoria)}</select></label>
    <label class="campo"><span>Tipo de gasto</span><select name="tipo">${opcoes(A.tipos.includes(i.tipo) ? A.tipos : [...A.tipos, i.tipo], i.tipo)}</select></label>
  </div>
  <label class="campo campo-parcelas" ${i.recorrente === false ? "hidden" : ""}><span>Parcelas (opcional, ex.: 10/60)</span><input name="parcelas" value="${esc(i.parcelas || "")}" placeholder="—"></label>
  ${campoObs(i.obs)}
  ${rodapeModal(!novoItem)}`;
  abrirModal(html, async (d, botao, form) => {
    if (botao === "excluir") {
      if (!confirm(`Excluir "${item.descricao}" de ${rotuloMes(S.mes)}?`)) return false;
      return tentar(() => store.remover("despesas", item.id), "Excluída");
    }
    if (!d.descricao.trim()) { toast("Dê um nome à despesa"); return false; }
    const valor = lerValor(form); if (valor === null) return false;
    const dados = { descricao: d.descricao.trim(), valor, status: d.status, categoria: d.categoria, tipo: d.tipo, parcelas: d.parcelas.trim(), recorrente: d.frequencia !== "avulsa", obs: d.obs.trim() };
    if (novoItem) await tentar(() => store.adicionar("despesas", { ...dados, mes: S.mes }), "Despesa adicionada");
    else await tentar(() => store.atualizar("despesas", item.id, dados), "Despesa atualizada");
  }, (form) => {
    ligarSugestaoTipo(form);
    form.querySelectorAll("[name=frequencia]").forEach((r) => r.addEventListener("change", () => {
      form.querySelector(".campo-parcelas").hidden = form.querySelector("[name=frequencia]:checked").value === "avulsa";
    }));
  });
}

// ---------- Renda ----------
function formRenda(item, tipoNovo) {
  const A = aj();
  const tipo = item ? (item.tipo === "receber" ? "receber" : "salario") : tipoNovo;
  const i = item || { pessoa: tipo === "receber" ? "Casal" : A.pessoas[0], recebido: false };
  const receber = tipo === "receber";
  const html = `<h2>${receber ? "A receber de alguém" : "Salário / entrada"}</h2>
  <label class="campo"><span>${receber ? "Do quê / de quem" : "Descrição"}</span><input name="descricao" required value="${esc(i.descricao || "")}" placeholder="${receber ? "ex.: combustível viagem (Sara, Joana)" : "ex.: Salário Igor"}" autocomplete="off"></label>
  <label class="campo"><span>Valor</span><input name="valor" inputmode="decimal" required value="${valorBR(i.valor)}" placeholder="0,00"></label>
  ${receber ? `<label class="check-linha"><input type="checkbox" name="recebido" ${i.recebido ? "checked" : ""}> Já recebi</label>`
    : `<label class="campo"><span>De quem</span><select name="pessoa">${opcoes(A.pessoas, i.pessoa)}</select></label>`}
  ${campoObs(i.obs)}
  ${rodapeModal(Boolean(item))}`;
  abrirModal(html, async (d, botao, form) => {
    if (botao === "excluir") {
      if (!confirm(`Excluir "${item.descricao}"?`)) return false;
      return tentar(() => store.remover("rendas", item.id), "Excluído");
    }
    if (!d.descricao.trim()) { toast("Preencha a descrição"); return false; }
    const valor = lerValor(form); if (valor === null) return false;
    const dados = receber
      ? { tipo: "receber", descricao: d.descricao.trim(), valor, obs: (d.obs || "").trim(), recebido: Boolean(d.recebido), pessoa: "Casal" }
      : { tipo: "salario", descricao: d.descricao.trim(), valor, pessoa: d.pessoa, recebido: true, obs: (d.obs || "").trim() };
    if (item) await tentar(() => store.atualizar("rendas", item.id, dados), "Atualizado");
    else await tentar(() => store.adicionar("rendas", { ...dados, mes: S.mes }), "Adicionado");
  });
}

// =====================================================================
// Ações em lote
// =====================================================================
function opsCopiarFixas() {
  const anterior = somaMes(S.mes, -1);
  const existentes = new Set(S.despesas.filter((d) => d.mes === S.mes).map((d) => semAcento(d.descricao)));
  const ops = [];
  for (const d of S.despesas.filter((x) => x.mes === anterior && x.recorrente !== false)) {
    if (existentes.has(semAcento(d.descricao))) continue;
    let parcelas = d.parcelas || "";
    const m = parcelas.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) { const a = Number(m[1]) + 1, t = Number(m[2]); if (a > t) continue; parcelas = `${a}/${t}`; }
    const { id, criadoEm, ...resto } = d;
    ops.push({ tipo: "add", col: "despesas", dados: { ...resto, mes: S.mes, status: "Pendente", parcelas } });
  }
  return ops;
}
function opsCopiarSalarios() {
  const anterior = somaMes(S.mes, -1);
  const existentes = new Set(S.rendas.filter((r) => r.mes === S.mes).map((r) => semAcento(r.descricao)));
  return S.rendas.filter((r) => r.mes === anterior && r.tipo !== "receber" && !existentes.has(semAcento(r.descricao)))
    .map(({ id, criadoEm, ...r }) => ({ tipo: "add", col: "rendas", dados: { ...r, mes: S.mes } }));
}

async function importarXlsx(arquivo) {
  toast("Lendo planilha…");
  let XLSX = window.XLSX;
  if (!XLSX) {
    try {
      await new Promise((ok, erro) => {
        const s = document.createElement("script");
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
        s.onload = ok; s.onerror = erro;
        document.head.appendChild(s);
      });
      XLSX = window.XLSX;
    } catch { return toast("Não consegui carregar o leitor de planilhas. Verifique a internet."); }
  }
  const wb = XLSX.read(await arquivo.arrayBuffer());
  const abas = {};
  for (const nome of wb.SheetNames) abas[nome] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" });
  const A = aj();
  const cartoes = [...A.cartoes];
  const r = lerPlanilha(abas, { cartoes, categorias: A.categorias.map((c) => c.nome) });
  if (!r.meses.length) return toast("Nenhuma aba de mês reconhecida (esperado: \"Novembro.26\")");

  const html = `<h2>Importar planilha</h2>
  <p>Encontrei <b>${r.meses.length} meses</b>, de ${rotuloMes(r.meses[0])} a ${rotuloMes(r.meses.at(-1))}:</p>
  <ul class="resumo-import">
    <li><b>${r.despesas.length}</b> despesas fixas</li>
    <li><b>${r.cartoes.length}</b> lançamentos de cartão</li>
    <li><b>${r.faturas.length}</b> valores de fatura informados</li>
    <li><b>${r.rendas.length}</b> rendas e valores a receber</li>
  </ul>
  ${r.ignoradas.length ? `<p class="dica pequena">Abas ignoradas: ${esc(r.ignoradas.join(", "))}</p>` : ""}
  <p class="dica">Os tipos de gasto foram sugeridos pelo nome de cada compra — dá para ajustar depois tocando no item. Dados que já existirem nesses ${r.meses.length} meses serão substituídos.</p>
  <div class="modal-acoes"><span></span><div><button class="btn" value="cancelar" formnovalidate>Cancelar</button><button class="btn btn-primario" value="salvar">Importar</button></div></div>`;
  abrirModal(html, async () => {
    const meses = new Set(r.meses);
    const ops = [];
    for (const col of ["despesas", "cartoes", "rendas", "faturas"]) {
      S[col].filter((x) => meses.has(x.mes)).forEach((x) => ops.push({ tipo: "delete", col, id: x.id }));
    }
    r.despesas.forEach((d) => ops.push({ tipo: "add", col: "despesas", dados: d }));
    r.cartoes.forEach((d) => ops.push({ tipo: "add", col: "cartoes", dados: { ...d, grupo: null, origem: "planilha" } }));
    r.rendas.forEach((d) => ops.push({ tipo: "add", col: "rendas", dados: d }));
    r.faturas.forEach((f) => ops.push({ tipo: "add", col: "faturas", id: faturaId(f.mes, f.cartao), dados: f }));
    toast("Importando…");
    await tentar(async () => {
      await store.lote(ops);
      if (cartoes.length !== A.cartoes.length) await salvarAjustes({ cartoes });
    }, `${r.meses.length} meses importados`);
  });
}

function exportarBackup() {
  const dados = { versao: 1, exportadoEm: new Date().toISOString(), ajustes: S.ajustes, despesas: S.despesas, cartoes: S.cartoes, rendas: S.rendas, faturas: S.faturas };
  const blob = new Blob([JSON.stringify(dados, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `financas-casal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function restaurarBackup(arquivo) {
  let dados;
  try { dados = JSON.parse(await arquivo.text()); } catch { return toast("Arquivo de backup inválido"); }
  const total = ["despesas", "cartoes", "rendas", "faturas"].reduce((s, c) => s + (dados[c]?.length || 0), 0);
  if (!confirm(`Restaurar ${total} lançamentos deste backup? Itens com o mesmo identificador serão sobrescritos.`)) return;
  const ops = [];
  for (const col of ["despesas", "cartoes", "rendas", "faturas"]) {
    (dados[col] || []).forEach(({ id, ...resto }) => ops.push({ tipo: "add", col, id, dados: resto }));
  }
  await tentar(async () => { await store.lote(ops); if (dados.ajustes) await store.salvarAjustes(dados.ajustes); }, "Backup restaurado");
}

// =====================================================================
// Eventos
// =====================================================================
function irPara(aba) {
  S.aba = abaValida(aba);
  aba = S.aba;
  history.replaceState(null, "", "#" + aba);
  render();
  window.scrollTo({ top: 0 });
}
function mudarMes(novo) {
  S.mes = novo;
  localStorage.setItem("fc_mes", novo);
  render();
}
const ciclo = { Pendente: "Pago", Pago: "Reservado", Reservado: "Pendente" };

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-acao]");
  if (!el || el.closest("#modal-form")) return;
  const { acao, id } = el.dataset;
  const c = () => calcMes(S.mes);
  switch (acao) {
    case "ir": return irPara(el.dataset.aba);
    case "mes-anterior": return mudarMes(somaMes(S.mes, -1));
    case "mes-proximo": return mudarMes(somaMes(S.mes, 1));
    case "novo":
      if (S.aba === "despesas") {
        if (S.filtroDesp === "cartoes") return formCartao();
        if (S.filtroDesp === "fixas" || S.filtroDesp === "avulsas") return formFixa(null, S.filtroDesp === "fixas");
        return escolherDespesa();
      }
      return escolherNovo();
    case "nova-fixa": return formFixa(null, el.dataset.fixa !== "0");
    case "filtro-desp": S.filtroDesp = el.dataset.f; return render();
    case "toggle-fixa": {
      const d = S.despesas.find((x) => x.id === id);
      const fixa = d.recorrente === false;
      return tentar(() => store.atualizar("despesas", id, { recorrente: fixa }), fixa ? "Agora é fixa: vai para os próximos meses" : "Agora é avulsa: só neste mês");
    }
    case "novo-cartao": return formCartao();
    case "nova-renda": return formRenda(null, el.dataset.tipo);
    case "editar-fixa": return formFixa(S.despesas.find((x) => x.id === id));
    case "editar-cartao": return formCartao(S.cartoes.find((x) => x.id === id));
    case "editar-renda": return formRenda(S.rendas.find((x) => x.id === id));
    case "editar-fatura": return formFatura(el.dataset.cartao);
    case "ir-cartao": S.filtroCartao = el.dataset.cartao; S.filtroDesp = "cartoes"; return irPara("despesas");
    case "rolar-cartoes": return document.getElementById("secao-cartoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    case "filtro-cartao": S.filtroCartao = el.dataset.cartao; return render();
    case "periodo": S.periodo = Number(el.dataset.n); return render();
    case "status-fixa": {
      const d = S.despesas.find((x) => x.id === id);
      return tentar(() => store.atualizar("despesas", id, { status: ciclo[d.status] || "Pago" }));
    }
    case "status-fatura": {
      const f = c().faturas.find((x) => x.nome === id);
      return tentar(() => store.definir("faturas", faturaId(S.mes, id), { mes: S.mes, cartao: id, status: f?.status === "Pago" ? "Pendente" : "Pago", valorInformado: f?.informado ?? null }));
    }
    case "toggle-recebido": {
      const r = S.rendas.find((x) => x.id === id);
      return tentar(() => store.atualizar("rendas", id, { recebido: !r.recebido }));
    }
    case "copiar-fixas": {
      const ops = opsCopiarFixas();
      if (!ops.length) return toast("Nada novo para copiar");
      return tentar(() => store.lote(ops), `${ops.length} despesas copiadas`);
    }
    case "copiar-salarios": {
      const ops = opsCopiarSalarios();
      return tentar(() => store.lote(ops), `${ops.length} salários copiados`);
    }
    case "copiar-mes": {
      const ops = [...opsCopiarFixas(), ...opsCopiarSalarios()];
      if (!ops.length) return toast("Nada para copiar");
      return tentar(() => store.lote(ops), `${ops.length} lançamentos copiados`);
    }
    case "add-lista": {
      const lista = el.dataset.lista;
      const inp = $("#add-" + lista);
      const v = inp.value.trim();
      if (!v) return;
      const atual = aj()[lista];
      if (atual.some((x) => semAcento(x) === semAcento(v))) return toast("Já existe");
      return tentar(() => salvarAjustes({ [lista]: [...atual, v] }), "Adicionado");
    }
    case "remover-lista": {
      const lista = el.dataset.lista;
      return tentar(() => salvarAjustes({ [lista]: aj()[lista].filter((x) => x !== el.dataset.valor) }));
    }
    case "salvar-categorias": {
      const cats = aj().categorias.map((cat, i) => ({
        nome: ($(`[data-cat-nome="${i}"]`).value || cat.nome).trim(),
        ideal: Number($(`[data-cat-ideal="${i}"]`).value) || 0
      }));
      const somaPct = cats.reduce((s, x) => s + x.ideal, 0);
      return tentar(() => salvarAjustes({ categorias: cats, categoriaFaturas: $("#cat-faturas").value }), somaPct === 100 ? "Categorias salvas" : `Salvo (os % somam ${somaPct}%)`);
    }
    case "exportar": return exportarBackup();
    case "alternar-menu": {
      const oculto = !$("#app").classList.contains("menu-oculto");
      aplicarMenu(oculto);
      try { localStorage.setItem("fc_menu_oculto", oculto ? "1" : "0"); } catch {}
      return;
    }
    case "sair": return tentar(() => store.sair());
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id?.startsWith("add-")) {
    e.preventDefault();
    document.querySelector(`[data-acao="add-lista"][data-lista="${e.target.id.slice(4)}"]`)?.click();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "input-mes" && e.target.value) mudarMes(e.target.value);
  if (e.target.classList?.contains("cor-cartao")) {
    const cores = { ...aj().coresCartoes, [e.target.dataset.cartao]: e.target.value };
    tentar(() => salvarAjustes({ coresCartoes: cores }), "Cor salva");
  }
  if (e.target.id === "arquivo-xlsx" && e.target.files[0]) { importarXlsx(e.target.files[0]); e.target.value = ""; }
  if (e.target.id === "arquivo-backup" && e.target.files[0]) { restaurarBackup(e.target.files[0]); e.target.value = ""; }
});
$("#modal").addEventListener("click", (e) => { if (e.target === modal()) modal().close(); });
window.addEventListener("hashchange", () => { const a = location.hash.slice(1); if (a && abaValida(a) !== S.aba) irPara(a); });
window.addEventListener("online", renderTopo);
window.addEventListener("offline", renderTopo);

// Swipe lateral troca de mês no celular (fora de listas roláveis horizontais)
let toqueX = null, toqueY = null;
$("#tela").addEventListener("touchstart", (e) => { if (e.target.closest(".rolagem,canvas")) return; toqueX = e.touches[0].clientX; toqueY = e.touches[0].clientY; }, { passive: true });
$("#tela").addEventListener("touchend", (e) => {
  if (toqueX === null) return;
  const dx = e.changedTouches[0].clientX - toqueX, dy = e.changedTouches[0].clientY - toqueY;
  toqueX = null;
  if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) mudarMes(somaMes(S.mes, dx < 0 ? 1 : -1));
}, { passive: true });

// =====================================================================
// Inicialização
// =====================================================================
let cancelar = [];
function ligarDados() {
  cancelar.forEach((f) => f());
  cancelar = ["despesas", "cartoes", "rendas", "faturas"].map((col) => store.observar(col, (itens) => { S[col] = itens; agendarRender(); }));
  cancelar.push(store.observarAjustes((a) => { S.ajustes = a; agendarRender(); }));
}
let renderPendente = false;
function agendarRender() {
  if (renderPendente) return;
  renderPendente = true;
  requestAnimationFrame(() => {
    renderPendente = false;
    // não re-renderiza por baixo de um formulário aberto (evita perder o que está sendo digitado)
    if (modal().open && S.aba !== "graficos") { setTimeout(agendarRender, 400); return; }
    render();
  });
}

function aplicarMenu(oculto) {
  $("#app").classList.toggle("menu-oculto", oculto);
  const b = $("#btn-menu");
  b.setAttribute("aria-label", oculto ? "Mostrar menu" : "Ocultar menu");
  b.title = oculto ? "Mostrar menu" : "Ocultar menu";
  b.setAttribute("aria-expanded", String(!oculto));
  if (S.aba === "graficos") setTimeout(() => S.graficos.forEach((g) => g.resize()), 50);
}
aplicarMenu(localStorage.getItem("fc_menu_oculto") === "1");

function mostrarErro(e) {
  const p = $("#erro-login");
  p.textContent = e.message || String(e);
  p.hidden = false;
}

$("#btn-entrar").addEventListener("click", () => store.entrar().catch(mostrarErro));
$("#aviso-local").hidden = firebaseConfigurado;

store.iniciar((usuario) => {
  S.usuario = usuario;
  $("#tela-login").hidden = Boolean(usuario);
  $("#app").hidden = !usuario;
  if (usuario) { ligarDados(); render(); }
  else { cancelar.forEach((f) => f()); cancelar = []; }
}, mostrarErro).catch((e) => {
  $("#tela-login").hidden = false;
  mostrarErro(new Error("Não foi possível conectar ao Firebase: " + e.message));
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
