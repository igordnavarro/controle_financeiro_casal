# Finanças do Casal

App de controle financeiro do Igor e da Thais, feito a partir da planilha "Orçamento mensal Casal".
Funciona no navegador do computador, celular e tablet (dá para "instalar" na tela inicial),
com login Google e sincronização em tempo real: o que um lança aparece no aparelho do outro na hora.

**O que tem**
- **Resumo do mês**: rendas, despesas, sobra/falta, real × ideal por categoria (50/25/15/10), gastos por tipo, faturas e pendências.
- **Despesas**: fixas (repetem todo mês) e avulsas (só daquele mês), com troca entre as duas num toque; por categoria, status Pendente/Pago/Reservado com um toque, botão "copiar fixas do mês anterior" (parcelas tipo 10/60 avançam sozinhas; avulsas não são copiadas).
- **Cartões**: compras à vista ou parceladas — lança uma vez e as próximas parcelas caem nos meses seguintes. Fatura por cartão, quem gastou (Igor/Thais/Casal), e campo para o valor real da fatura quando nem tudo foi detalhado.
- **Rendas**: salários e "a receber de alguém", com marcação de recebido.
- **Gráficos**: por tipo de gasto, fatura por cartão ao longo do tempo, tipos ao longo do tempo, rendas × despesas, real × ideal.
- **Importação da planilha** (.xlsx) com todos os meses, **backup** em JSON, funciona **offline**.

Não precisa instalar nada nem compilar: são arquivos estáticos.

---

## Passo 1 — Testar no seu computador (opcional, 2 min)

Sem configurar nada, o app abre em **modo local** (dados só naquele navegador).

```bash
cd financas-casal
python3 -m http.server 8000
```
Abra http://localhost:8000. (Abrir o `index.html` direto com duplo clique não funciona — precisa ser por um servidor.)

## Passo 2 — Criar o Firebase (login Google + banco sincronizado) — gratuito

1. Acesse https://console.firebase.google.com → **Adicionar projeto** → nome "financas-casal" (pode desativar o Google Analytics).
2. **Authentication** → Começar → aba **Método de login** → **Google** → Ativar → escolha o e-mail de suporte → Salvar.
3. **Firestore Database** → Criar banco de dados → local `southamerica-east1 (São Paulo)` → modo **produção**.
4. Ainda no Firestore, aba **Regras**: apague tudo, cole o conteúdo do arquivo `firestore.rules`
   **trocando `email_da_thais@gmail.com` pelo e-mail Google da Thais** (em minúsculas) → **Publicar**.
5. ⚙️ **Configurações do projeto** → em "Seus apps" clique no ícone **`</>`** (Web) → apelido "web" → Registrar.
   Copie os valores do `firebaseConfig` que aparecem.
6. Abra `js/config.js` e:
   - cole os valores em `firebaseConfig`;
   - troque `EMAIL_DA_THAIS@gmail.com` pelo e-mail dela em `EMAILS_PERMITIDOS`.

> As chaves do `firebaseConfig` não são senhas — podem ficar públicas no GitHub. Quem protege os dados são as regras do passo 4 (só os dois e-mails leem e escrevem).

## Passo 3 — Publicar no GitHub Pages

1. Crie um repositório em https://github.com/new (ex.: `financas-casal`). Pode ser **público** (os dados não ficam no GitHub, ficam no Firebase).
   Se quiser repositório privado, o GitHub Pages exige plano pago.
2. Envie os arquivos desta pasta para o repositório. Pelo site: **Add file → Upload files** → arraste tudo (incluindo as pastas `css`, `js`, `icons` e o arquivo `.nojekyll`) → Commit.
   Ou pelo terminal:
   ```bash
   cd financas-casal
   git init && git add . && git commit -m "Finanças do Casal"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/financas-casal.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages** → Source: **Deploy from a branch** → Branch `main` / pasta `/ (root)` → Save.
   Em ~1 minuto o app fica em `https://SEU_USUARIO.github.io/financas-casal/`.
4. **Importante:** no Firebase → Authentication → **Configurações → Domínios autorizados** → **Adicionar domínio** → `SEU_USUARIO.github.io`.
   Sem isso o botão "Entrar com Google" dá erro.

## Passo 4 — Importar a planilha

1. No Google Sheets: **Arquivo → Fazer download → Microsoft Excel (.xlsx)**.
2. No app: **Ajustes → Importar a planilha** → escolha o arquivo → confira o resumo → **Importar**.

Como a importação funciona:
- Cada aba no formato `Mês.AA` (ex.: `Novembro.26`) vira um mês. Abas como `Empréstimo` e `Agosto.23 Original` são ignoradas.
- As linhas "Cartão Cresol", "Cartao ITAÚ Black" etc. viram o **valor informado da fatura** daquele cartão (assim os totais batem com a planilha, mesmo quando a fatura tem compras que não foram detalhadas).
- Linhas de cartão com a coluna "Cartão" em branco herdam o cartão da linha de cima (como na planilha).
- O **tipo de gasto** (Casa, Transporte, Pets, Viagem…) é sugerido pelo nome de cada compra — ajuste tocando no item se precisar.
- Meses importados substituem o que já existir nesses meses no app; dá para importar de novo sem duplicar.

Conferido com a aba de setembro/2025: rendas R$ 12.744,83, despesas R$ 14.707,61, sobra −R$ 1.962,78 — iguais à planilha.

## Passo 5 — Instalar no celular e tablet

- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app** / Adicionar à tela inicial.
- **iPhone/iPad (Safari):** abra o link → botão Compartilhar → **Adicionar à Tela de Início**.

Cada um entra com a própria conta Google; os dois veem e editam os mesmos dados.

---

## Dia a dia

- **Botão +**: lança compra no cartão, despesa fixa, salário ou valor a receber.
- **Compra parcelada**: informe o valor (da parcela ou total) e o nº de parcelas. Para uma compra que já está na parcela 3 de 10, coloque 3 em "Parcela deste mês".
- **Virou o mês**: no Resumo aparece "Copiar fixas e salários do mês anterior". As parcelas de cartão já estarão lá.
- **Fatura do banco diferente da soma dos itens**: na aba Cartões, "informar valor da fatura".
- **Trocar de mês**: setas no topo, toque no nome do mês, ou deslize para os lados no celular.
- **Ajustes**: cartões, tipos de gasto, pessoas, categorias e % ideal (50/25/15/10), e em qual categoria as faturas contam (padrão: Estilo de vida, como na planilha).

## Estrutura

```
index.html            página única
css/styles.css        visual (claro/escuro automático, responsivo)
js/config.js          ← você edita: Firebase e e-mails
js/app.js             telas, formulários, gráficos
js/store.js           Firebase (Auth + Firestore offline) ou modo local
js/importer.js        leitura da planilha
sw.js, manifest       app instalável e offline
firestore.rules       regras de segurança do banco
```

Bibliotecas carregadas sob demanda via CDN: Firebase 10, Chart.js 4 (gráficos) e SheetJS (só ao importar).

## Problemas comuns

- **"auth/unauthorized-domain"** → faltou o passo 3.4 (domínio autorizado).
- **"O e-mail … não tem acesso"** → o e-mail não está em `js/config.js`.
- **Entra mas não aparecem dados / "Missing or insufficient permissions"** → confira as regras do Firestore (passo 2.4), e-mails em minúsculas.
- **Login no iPhone instalado na tela inicial não abre** → abra uma vez pelo Safari normal, faça login, e depois use o ícone.
- **Atualizei o código e o celular não mudou** → feche e abra o app de novo (ele busca a versão nova na rede primeiro).
