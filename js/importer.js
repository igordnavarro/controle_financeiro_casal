// Importa a planilha "Orçamento mensal Casal" (exportada do Google Sheets como .xlsx).
// Cada aba "Mês.AA" vira um mês no app. Funciona sobre uma matriz de células
// (array de linhas), então pode ser testado sem o navegador.

const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
};

export function semAcento(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// "Maio.22" -> "2022-05"; "Agosto.23 Original" e "Empréstimo" -> null
export function mesDaAba(nome) {
  const m = semAcento(nome).match(/^([a-z]+)\s*[.\-/ ]\s*(\d{2,4})$/);
  if (!m || !MESES[m[1]]) return null;
  let ano = Number(m[2]);
  if (ano < 100) ano += 2000;
  return `${ano}-${String(MESES[m[1]]).padStart(2, "0")}`;
}

export function dinheiro(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  const neg = s.startsWith("-") || s.startsWith("(");
  s = s.replace(/[-()]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100) / 100;
}

function inteiro(v) {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

const REGRAS_TIPO = [
  ["Taxas e juros", /\biof\b|juros|multa|estorno|taxa|anuidade|anuiidade|tarifa/],
  ["Poupança", /poupanca|investimento(?! novo estudio)|reserva|tesouro|cdb/],
  ["Assinaturas", /netflix|spot|youtube|google|storage|armazenamento|icloud|prime|disney|hbo|deezer|assinatura|capcut|meli \+|queima diaria|recarga|\bvivo\b|claro|tim\b/],
  ["Pets", /racao|faisca|fasica|zenrelia|vet|pet|banho e tosa|petshop/],
  ["Viagem e lazer", /airbnb|hotel|passage|viagem|viuagem|eurotrip|aereo|aero|beto carrero|floripa|penha|cinema|show|cadeira de praia|lanche|restaurante|ifood|bar |camping|acampamento|almoco|cafe da manha|alimentacao|budpark|madeiro|piemonte|\bbus\b|jogo|violao|bateria/],
  ["Transporte", /combust|gasolina|pedagio|carro|uber|onibus|estacionamento|ipva|seguro carro|oficina|pneu|chave do carro|autozone|ford|biscicleta|bicicleta/],
  ["Estúdio", /estudio|estudo|micromotor|micro motor|tablet|placa|tintas|aliexpress|esmalte|broca|\bgel\b|geis|lixa|mandril|palito|topcoat|kinectis|carmen lee|kit gravacao|atelie|prep|unhas/],
  ["Cuidados pessoais", /cabelo|perfume|shampoo|condicionador|creme|maquiagem|hidratante|sabonete|gilete|corte e barba|barbearia|produtos rosto|produtos de cabelo|tesoura/],
  ["Saúde", /remedio|consulta|farmacia|medic|dentista|exame|plano de saude|seguro de vida|unimed|inalador|cirurgia|canetas emagrecedoras|panvel|raia|dipirona|boxe|academia/],
  ["Casa", /aluguel|agua|energia|copel|luz|internet|geladeira|micro|fogao|condominio|\bgas\b|mudanca|frete|casa|mobilia|movel|cortina|varao|cortador de grama|aspirador|papel de parede|torneira|mesa|escorredor|faqueiro|talheres|copos|aquecedor|plantas|rejunte|ceramica|material de construcao|seguro locacao|tela|cama/],
  ["Mercado", /mercado(?! pago| livre)|supermercado|atacad|padaria|acougue|hortifruti|feira/],
  ["Roupas", /roupa|sapato|havan|renner|riachuelo|tenis|t3nis|pernambucanas|calcado|vestido|calca|blusa|camisa|camiseta|sandalia|sutia|chinelo|bermuda|\bmaio\b|shorts|uniforme|mala|acessorios thais|\bcea\b/],
  ["Educação", /curso|faculdade|livro|escola|aula|mentoria|\bmba\b|ministros/],
  ["Presentes", /presente|aniversario|lembrancinha|pascoa|doces/]
];

export function adivinharTipo(descricao) {
  const d = semAcento(descricao);
  if (!d) return "Outros";
  for (const [tipo, re] of REGRAS_TIPO) if (re.test(d)) return tipo;
  return "Outros";
}

function normalizarCategoria(c, categorias) {
  const n = semAcento(c);
  if (!n) return null;
  const achada = categorias.find((x) => semAcento(x) === n);
  if (achada) return achada;
  if (n.startsWith("essencial")) return "Essencial";
  if (n.startsWith("estilo")) return "Estilo de vida";
  if (n.startsWith("mesada")) return "Mesada casal";
  if (n.startsWith("poupa") || n.startsWith("guard")) return "Guardado";
  return null;
}

function normalizarCartao(nome, cartoesConhecidos) {
  let n = semAcento(nome).replace(/\s+/g, " ");
  if (!n) return "";
  if (/^mercado ?n?pago$/.test(n)) n = "mercado pago";
  const chave = n.replace(/\s/g, "");
  const achado = cartoesConhecidos.find((c) => semAcento(c).replace(/\s/g, "") === chave);
  if (achado) return achado;
  // Capitaliza palavras: "cresol igor" -> "Cresol Igor"
  return n.replace(/\b\p{L}/gu, (l) => l.toUpperCase());
}

// "Cartão Nu Igor" -> "Nubank Igor" (cada palavra é início de uma palavra do cartão)
export function cartaoDaFatura(desc, cartoesConhecidos) {
  const direto = normalizarCartao(String(desc).replace(/^\s*cart[aã]o\s*/i, ""), [...cartoesConhecidos]);
  if (cartoesConhecidos.includes(direto)) return direto;
  const tokens = semAcento(desc).replace(/^cartao\s*/, "").split(/\s+/).filter(Boolean);
  let melhor = null, sobra = Infinity;
  for (const c of cartoesConhecidos) {
    const ct = semAcento(c).split(/\s+/);
    if (tokens.length && tokens.every((t) => ct.some((w) => w.startsWith(t)))) {
      if (ct.length - tokens.length < sobra) { melhor = c; sobra = ct.length - tokens.length; }
    }
  }
  if (melhor) return melhor;
  const nome = String(desc).trim().replace(/^cart[aã]o\s*/i, "").replace(/\b\p{L}/gu, (l) => l.toUpperCase());
  if (nome && !cartoesConhecidos.includes(nome)) cartoesConhecidos.push(nome);
  return nome || "Sem cartão";
}

function quemDoCartao(cartao) {
  const n = semAcento(cartao);
  if (n.includes("thais")) return "Thais";
  if (n.includes("igor")) return "Igor";
  return "Casal";
}

// Lê uma aba (matriz de linhas) e devolve { despesas, cartoes, rendas }
export function lerAba(linhas, mes, opcoes = {}) {
  const categorias = opcoes.categorias || ["Essencial", "Estilo de vida", "Mesada casal", "Guardado"];
  const cartoesConhecidos = opcoes.cartoes || [];
  const L = linhas.map((l) => (Array.isArray(l) ? l : []));
  const txt = (r, c) => (c == null || c < 0 ? "" : String(L[r]?.[c] ?? "").trim());
  const achaColuna = (r, re, de = 0) => { const i = L[r].slice(de).findIndex((v) => re.test(semAcento(v))); return i < 0 ? -1 : i + de; };

  const out = { despesas: [], cartoes: [], rendas: [], faturas: [] };

  // ----- cabeçalhos -----
  let hDesp = -1, hCart = -1;
  for (let r = 0; r < Math.min(L.length, 15); r++) {
    const row = L[r].map(semAcento);
    if (hDesp < 0 && row.includes("categoria") && row.some((v) => v.startsWith("despesa"))) hDesp = r;
    if (hCart < 0 && row.includes("o que")) hCart = r;
  }

  // ----- orçamento (despesas fixas + rendas) -----
  if (hDesp >= 0) {
    const cCat = achaColuna(hDesp, /^categoria$/);
    const cDesc = achaColuna(hDesp, /^despesa/);
    const cVal = achaColuna(hDesp, /^valor/);
    const cParc = achaColuna(hDesp, /^parcela/);
    const cStatus = achaColuna(hDesp, /^status/);
    let secao = "despesa";
    let catAtual = categorias[0];

    for (let r = hDesp + 1; r < L.length; r++) {
      const a = semAcento(txt(r, cCat));
      if (a.startsWith("total de despesas")) { secao = "fim-despesas"; continue; }
      if (a.startsWith("total de rendas") || a === "sobra" || a.startsWith("total de despesas por")) break;
      if (a === "renda" || a.startsWith("renda")) secao = "renda";

      const desc = txt(r, cDesc);
      const valor = dinheiro(L[r][cVal]);

      if (secao === "despesa") {
        const cat = normalizarCategoria(txt(r, cCat), categorias);
        if (cat) catAtual = cat;
        if (!desc || valor === null) continue;
        const status = semAcento(txt(r, cStatus));
        if (/^cartao/.test(semAcento(desc))) {
          // linha de fatura ("Cartão Cresol"): vira o valor informado da fatura daquele cartão
          out.faturas.push({ mes, cartao: desc, valorInformado: valor, status: status.startsWith("pago") ? "Pago" : "Pendente" });
          continue;
        }
        out.despesas.push({
          mes, categoria: catAtual, descricao: desc, valor,
          parcelas: txt(r, cParc),
          status: status.startsWith("pago") ? "Pago" : status.startsWith("reserv") ? "Reservado" : "Pendente",
          tipo: adivinharTipo(desc), recorrente: true
        });
      } else if (secao === "renda") {
        if (valor === null) continue;
        const dn = semAcento(desc);
        if (desc && dn.includes("receber")) { secao = "receber"; }
        if (desc && !dn.includes("receber")) {
          out.rendas.push({
            mes, tipo: "salario", descricao: desc, valor,
            pessoa: dn.includes("thais") ? "Thais" : dn.includes("igor") ? "Igor" : "Casal",
            recebido: true
          });
          continue;
        }
      }
      if (secao === "receber") {
        if (valor === null) continue;
        // na planilha: valor na coluna C, descrição na D, observação na E, status na F
        const d = txt(r, cVal + 1) || desc || "A receber";
        const obs = txt(r, cVal + 2);
        const st = semAcento(txt(r, cVal + 3));
        out.rendas.push({ mes, tipo: "receber", descricao: d, valor, obs, pessoa: "Casal", recebido: st.startsWith("pago") || st.startsWith("receb") });
      }
    }
  }

  // ----- cartões -----
  if (hCart >= 0) {
    const cO = achaColuna(hCart, /^o que$/);
    const cC = achaColuna(hCart, /^cartao/, cO);
    const cPA = achaColuna(hCart, /^parcela atual/, cO);
    const cPT = achaColuna(hCart, /^parcela total/, cO);
    let cVT = achaColuna(hCart, /^valor total/, cO);
    if (cVT < 0) cVT = achaColuna(hCart, /^valor$/, cO);
    const cVI = achaColuna(hCart, /^valor igor/, cO);
    const cVTh = achaColuna(hCart, /^valor thais/, cO);
    const cEst = achaColuna(hCart, /estudio/, cO);
    let cartaoAnterior = "";
    for (let r = hCart + 1; r < L.length; r++) {
      const desc = txt(r, cO);
      if (!desc || semAcento(desc) === "total") continue;
      const valor = dinheiro(L[r][cVT]);
      if (valor === null) continue;
      const cartao = normalizarCartao(txt(r, cC), cartoesConhecidos) || cartaoAnterior || "Sem cartão";
      cartaoAnterior = cartao;
      const vi = dinheiro(L[r][cVI]) || 0, vt = dinheiro(L[r][cVTh]) || 0;
      const quem = vi && !vt ? "Igor" : vt && !vi ? "Thais" : quemDoCartao(cartao);
      const doEstudio = cEst >= 0 && semAcento(txt(r, cEst)).startsWith("sim");
      const parcelaTotal = Math.max(1, inteiro(L[r][cPT]) || 1);
      out.cartoes.push({
        mes, descricao: desc.replace(/\s+/g, " "), cartao, valor,
        parcelaAtual: Math.min(parcelaTotal, Math.max(1, inteiro(L[r][cPA]) || 1)),
        parcelaTotal,
        quem, tipo: doEstudio ? "Estúdio" : adivinharTipo(desc)
      });
    }
  }
  // as faturas são associadas depois de ler os cartões, para conhecer todos os nomes
  const nomesCartoes = [...cartoesConhecidos];
  for (const c of out.cartoes) if (!nomesCartoes.includes(c.cartao)) nomesCartoes.push(c.cartao);
  out.faturas.forEach((f) => { f.cartao = cartaoDaFatura(f.cartao, nomesCartoes); });
  for (const n of nomesCartoes) if (!cartoesConhecidos.includes(n)) cartoesConhecidos.push(n);
  return out;
}

// Recebe { nomeDaAba: matriz } e devolve { meses: [...], despesas, cartoes, rendas, ignoradas }
export function lerPlanilha(abas, opcoes = {}) {
  const res = { meses: [], despesas: [], cartoes: [], rendas: [], faturas: [], ignoradas: [] };
  for (const [nome, linhas] of Object.entries(abas)) {
    const mes = mesDaAba(nome);
    if (!mes || res.meses.includes(mes)) { res.ignoradas.push(nome); continue; }
    const r = lerAba(linhas, mes, opcoes);
    if (!r.despesas.length && !r.cartoes.length && !r.rendas.length && !r.faturas.length) { res.ignoradas.push(nome); continue; }
    res.meses.push(mes);
    res.despesas.push(...r.despesas);
    res.cartoes.push(...r.cartoes);
    res.rendas.push(...r.rendas);
    res.faturas.push(...r.faturas);
    for (const c of r.cartoes) if (opcoes.cartoes && !opcoes.cartoes.includes(c.cartao)) opcoes.cartoes.push(c.cartao);
  }
  res.meses.sort();
  return res;
}
