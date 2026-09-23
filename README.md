# Instruções do Projeto

## Como Executar

### 1. Instalar as dependências
Antes de iniciar, certifique-se de ter o [Node.js](https://nodejs.org/) instalado. Em seguida, rode o comando abaixo na raiz do projeto para instalar todas as dependências necessárias:

```bash
npm install
```

### 2. Executar o Tailwind CSS CLI
Para a extensão detectar suas mudanças feitas com tailwind, utilize o comando abaixo

```bash
npx.cmd @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch
```

Esse comando criará um arquivo chamado "output.css" na pasta "src", ele será seu style.css e use ele durante o processo de desenvolvimento

> `--watch` apenas faz com que o Tailwind atualize o arquivo `output.css` automaticamente sempre que você fizer alterações em seu popup.html