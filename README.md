# Instruções do Projeto

## Testar a extensão com o backend

A análise de preços vem do backend ([atala-ia-back](https://github.com/AnaBia-31/atala-ia-back)).
Para testar tudo junto no seu computador:

1. **Suba o backend** (na pasta do atala-ia-back, seguindo o README de lá):

```bash
uvicorn app.main:app --reload
```

2. **Carregue a extensão no Chrome:** abra `chrome://extensions`, ligue o **Modo do desenvolvedor**,
   clique em **Carregar sem compactação** e escolha esta pasta. Depois de mudar algum arquivo,
   clique no botão de recarregar da extensão.
3. **Abra uma página de produto** (Amazon, Mercado Livre, KaBuM...) e clique no ícone do Atala.IA.

Como funciona:
- `src/extrator.js` lê título, preço, preço riscado e imagem da página aberta.
- `src/app.js` manda esses dados para a API e mostra a análise, o gráfico, o Histórico e os Alertas.
- `src/api.js` faz as chamadas à API. O endereço dela fica em `src/config.js`.
- A extensão **não tem login** (o login é só do app mobile). O Histórico, os Alertas e os Ajustes
  ficam guardados no próprio navegador (`chrome.storage`); os preços atuais vêm da API.
- Na primeira vez que um produto é aberto ainda não há histórico. Se a loja mostra um preço
  riscado ("de R$ X por R$ Y"), a análise usa esse desconto. Para a apresentação, dá para gerar um
  histórico **simulado** de um produto com `python seed.py --url "<url do produto>"` no backend.
- Para testar só o visual sem instalar a extensão, abra o `popup.html` por um servidor local
  passando um produto na URL, ex.: `popup.html?titulo=Fone&preco=199.90&preco_original=259.90`.

---

## Como Executar na Escola (Rotina Padrão)

### 1. Permissão do PowerShell
Antes de rodar qualquer comando, libere a execução de scripts no PowerShell da escola:

```bash
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

```

### 2. Instalar as dependências

Certifique-se de ter o [Node.js](https://nodejs.org/) instalado e rode na raiz do projeto:

```bash
npm install

```

### 3. Executar o Tailwind CSS CLI

Para a extensão detectar suas mudanças feitas com Tailwind, utilize o comando:

```bash
npx.cmd @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch

```

Esse comando criará o arquivo `output.css` na pasta `src`, que funcionará como seu `style.css` durante o processo de desenvolvimento.

> `--watch` apenas faz com que o Tailwind atualize o arquivo `output.css` automaticamente sempre que você fizer alterações em seu `popup.html`.

---

## Fluxo do Git: Criar Branch e Mandar para a Main

### 1. Criar e mudar para uma nova branch

```bash
git checkout -b nome-da-sua-branch

```

### 2. Salvar suas alterações locais

```bash
git add .
git commit -m "Descrição das alterações"

```

### 3. Enviar a nova branch para o GitHub

```bash
git push origin nome-da-sua-branch

```

### 4. Mandar as alterações para a `main`

```bash
git checkout main
git pull origin main
git merge nome-da-sua-branch
git push origin main

```

---

## Links e Recursos

* **Biblioteca de Ícones (Lucide Icons):** [lucide.dev/icons](https://lucide.dev/icons)
* **Pesquisa Teórica - CNW:** [Acessar pesquisa téorica - CNW](https://www.google.com/search?q=https://centropaulasouza-my.sharepoint.com/:w:/g/personal/evelyn_novais_aluno_cps_sp_gov_br/IQAs2vxCc8JvQJbC3ofhCOMQATchMG3ksxXTMMjVjRsdrO0%3Fe%3DYFqLzF)
