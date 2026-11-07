// =====================================================================
//  CONFIGURAÇÃO — edite este arquivo depois de criar o projeto Firebase
//  (passo a passo no README.md)
// =====================================================================

// 1) Cole aqui o objeto "firebaseConfig" que o Firebase mostra em
//    Configurações do projeto → Seus apps → App da Web.
//    Enquanto estiver vazio, o app roda em "modo local" (dados só neste
//    navegador, sem login e sem sincronização) — útil para testar.
export const firebaseConfig = {
  apiKey: "AIzaSyCwsmIKvYP_VGLJ9NTisGmIEtNm4IhtdDc",
  authDomain: "controlefinanceiro-1a54e.firebaseapp.com",
  projectId: "controlefinanceiro-1a54e",
  storageBucket: "controlefinanceiro-1a54e.firebasestorage.app",
  messagingSenderId: "111843022457",
  appId: "1:111843022457:web:abfe41c7dce9bb9b99a6a8",
  measurementId: "G-TGNB0R3JFH"
};

// 2) E-mails Google que podem entrar no app. Os dois compartilham os mesmos dados.
//    (Coloque os mesmos e-mails no arquivo firestore.rules.)
export const EMAILS_PERMITIDOS = [
  "igordnavarro@gmail.com",
  "mendes.thathais@gmail.com"
];

// 3) Identificador da "casa" no banco. Pode deixar assim.
export const CASA_ID = "casal";

// Valores padrão (podem ser alterados depois na aba Ajustes do app)
export const PADRAO = {
  cartoes: ["Itau Black", "Cresol Igor", "Nubank Igor", "Nu Thais", "Itau Click Thais", "Itau MC Thais"],
  pessoas: ["Igor", "Thais", "Casal"],
  categorias: [
    { nome: "Essencial", ideal: 50 },
    { nome: "Estilo de vida", ideal: 25 },
    { nome: "Mesada casal", ideal: 15 },
    { nome: "Guardado", ideal: 10 }
  ],
  tipos: [
    "Casa", "Mercado", "Transporte", "Saúde", "Pets", "Assinaturas",
    "Viagem e lazer", "Roupas", "Cuidados pessoais", "Estúdio", "Educação",
    "Presentes", "Taxas e juros", "Poupança", "Outros"
  ]
};
