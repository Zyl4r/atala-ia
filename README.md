# Instruções do Projeto

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
