// =====================================================================
//  CONFIGURAÇÃO — edite este arquivo depois de criar o projeto Firebase
//  (passo a passo no README.md)
// =====================================================================

// 1) Cole aqui o objeto "firebaseConfig" que o Firebase mostra em
//    Configurações do projeto → Seus apps → App da Web.
//    Enquanto estiver vazio, o app roda em "modo local" (dados só neste
//    navegador, sem login e sem sincronização) — útil para testar.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// 2) E-mails Google que podem entrar no app. Os dois compartilham os mesmos dados.
//    (Coloque os mesmos e-mails no arquivo firestore.rules.)
export const EMAILS_PERMITIDOS = [
  "igordnavarro@gmail.com",
  "EMAIL_DA_THAIS@gmail.com"
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
    "Viagem e lazer", "Roupas", "Estúdio", "Educação", "Presentes", "Outros"
  ]
};
