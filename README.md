# RachaChain

dApp de **divisão de despesas em grupo** na blockchain. Projeto final da disciplina INF17402 – Blockchains e Smart Contracts (UFES).

Cada grupo de despesas (uma viagem, uma república, uma festa) é um contrato `Grupo`, criado pelo contrato principal `GrupoFactory` (*Contract Factory*). Os membros registram o que pagaram, o contrato calcula quanto cada um tem a receber ou deve, e as dívidas são quitadas em ETH pelo próprio contrato.

> **Status:** em desenvolvimento. Este README é, por enquanto, um guia para **preparar o ambiente e continuar o desenvolvimento** em qualquer computador.

---

## Sumário

1. [Status do projeto](#1-status-do-projeto)
2. [Estrutura do repositório](#2-estrutura-do-repositório)
3. [Preparar um computador novo](#3-preparar-um-computador-novo)
4. [Comandos do dia a dia](#4-comandos-do-dia-a-dia)
5. [Rodar a blockchain local](#5-rodar-a-blockchain-local)
6. [Configurar o MetaMask](#6-configurar-o-metamask)
7. [Fluxo de trabalho com Git (dupla)](#7-fluxo-de-trabalho-com-git-dupla)
8. [Variáveis secretas (`.env`) para a Sepolia](#8-variáveis-secretas-env-para-a-sepolia)
9. [Problemas comuns](#9-problemas-comuns)

---

## 1. Status do projeto

| Etapa | Situação |
|---|---|
| Contrato `Grupo` (membros, despesas, saldos, quitação) | ✅ pronto |
| Contrato `GrupoFactory` (cria grupos e chama `adicionarMembros`) | 🔄 em andamento |
| Testes unitários (Hardhat/Mocha) | ⏳ a fazer |
| Script de deploy (`scripts/deploy.js`) | ⏳ a fazer (ainda é o do boilerplate) |
| Deploy na Sepolia | ⏳ a fazer |
| Frontend (React + ethers.js) | ⏳ a fazer (ainda é o do boilerplate) |
| Hospedagem HTTP (Labgrad3 ou nuvem) | ⏳ a fazer |

**Prazos:** Entrega 2 (Sepolia + HTTP + GitHub + vídeo dos testes) até **03/dez às 17h**. Apresentação entre 03 e 10/dez.

---

## 2. Estrutura do repositório

```
rachachain/
├── contracts/
│   ├── Grupo.sol            ← um grupo de despesas (criado pela Factory)
│   ├── GrupoFactory.sol     ← contrato principal (Contract Factory)
│   └── Token.sol            ← do boilerplate (será removido)
├── test/                    ← testes unitários (Mocha + Chai)
├── scripts/
│   └── deploy.js            ← deploy dos contratos (a adaptar)
├── frontend/                ← dApp em React (a adaptar)
├── hardhat.config.js        ← configuração do Hardhat
├── .env                     ← chaves secretas (NÃO vai para o Git)
└── README.md
```

Pastas geradas automaticamente, que **não** vão para o Git: `node_modules/`, `frontend/node_modules/`, `artifacts/`, `cache/`.

---

## 3. Preparar um computador novo

Faça isso **uma vez** em cada computador.

### 3.1 Pré-requisitos

**Git:**
```bash
git --version
```
Se não estiver instalado (e você tiver permissão de administrador): `sudo apt install git`.

Configure seu nome e e-mail (usados nos commits):
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu-email-do-github@exemplo.com"
```

**Node.js:** o projeto usa o Hardhat 2.12.5, que suporta oficialmente o Node **até a versão 18**. Com o Node 20 funciona, mas aparece um aviso a cada comando (pode ser ignorado). A forma mais simples de instalar, **sem precisar de `sudo`**, é pelo `nvm`:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
node -v
```

> Se o terminal mostrar `(base)` no início da linha, o **conda** está ativo. Rode `conda deactivate` antes de trabalhar no projeto, para ele não interferir no Node.

**Navegador com MetaMask:** de preferência o **Chrome** (o MetaMask é mais estável nele do que no Firefox).

### 3.2 Clonar o repositório

```bash
cd ~/Documentos          # ou a pasta onde quiser guardar o projeto
git clone https://github.com/MiguelZMurad/rachachain.git
cd rachachain
```

> Na primeira vez que fizer `git push` num computador, o Git pede usuário e senha. A **senha é um Personal Access Token**, não a senha do GitHub. Crie em: GitHub → *Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token*, marcando o escopo `repo`.

### 3.3 Instalar as dependências

São **dois** projetos npm: o do Hardhat (raiz) e o do frontend.
```bash
npm install
cd frontend
npm install
cd ..
```

Avisos de `deprecated`, `EBADENGINE` e `vulnerabilities` são normais neste projeto (dependências antigas do boilerplate). **Não rode `npm audit fix --force`**: ele atualiza pacotes para versões incompatíveis e quebra o projeto.

### 3.4 Conferir que está tudo funcionando

```bash
npx hardhat compile
```
Deve terminar com `Compiled ... Solidity files successfully`. Na primeira vez, o Hardhat baixa o compilador Solidity (precisa de internet).

### 3.5 Criar o `.env` (só quando for fazer deploy na Sepolia)

Veja a [seção 8](#8-variáveis-secretas-env-para-a-sepolia). Para desenvolver e testar localmente, ele não é necessário.

---

## 4. Comandos do dia a dia

Todos os comandos `npx hardhat ...` devem ser rodados **na raiz do projeto** (`rachachain/`), nunca dentro de `frontend/`.

| O que fazer | Comando |
|---|---|
| Compilar os contratos | `npx hardhat compile` |
| Rodar todos os testes | `npx hardhat test` |
| Rodar um arquivo de teste | `npx hardhat test test/NomeDoArquivo.js` |
| Subir a blockchain local | `npx hardhat node` |
| Abrir o console interativo | `npx hardhat console --network localhost` |
| Fazer deploy local | `npx hardhat run scripts/deploy.js --network localhost` |
| Fazer deploy na Sepolia | `npx hardhat run scripts/deploy.js --network sepolia` |
| Iniciar o frontend | `cd frontend && npm run start` |
| Limpar arquivos compilados | `npx hardhat clean` |

> No console do Hardhat (prompt `>`), só se digita **JavaScript**. Para sair: `.exit`. No terminal, `Ctrl+C` duas vezes também sai.

---

## 5. Rodar a blockchain local

Para testar a dApp no navegador, são necessários **três terminais**:

| Terminal | Pasta | Comando | Observação |
|---|---|---|---|
| 1 | `rachachain/` | `npx hardhat node` | **Manter aberto.** Se fechar, a blockchain e os contratos somem. |
| 2 | `rachachain/` | `npx hardhat run scripts/deploy.js --network localhost` | Rodar de novo sempre que o Terminal 1 for reiniciado ou um contrato mudar. |
| 3 | `rachachain/frontend/` | `npm run start` | Abre a dApp em `http://localhost:3000`. |

O `npx hardhat node` lista 20 contas de teste com 10000 ETH cada, com suas chaves privadas. **Essas chaves são públicas**: use-as só na rede local, nunca na Sepolia nem na mainnet.

---

## 6. Configurar o MetaMask

### 6.1 Rede local do Hardhat

Com o `npx hardhat node` rodando:
1. Abra o MetaMask → seletor de rede → **Adicionar uma rede personalizada**.
2. Preencha:
   - **Nome da rede:** `Hardhat Local`
   - **URL RPC padrão:** `http://127.0.0.1:8545/`
   - **ID da cadeia:** `31337`
   - **Símbolo da moeda:** `ETH`
3. Salve e selecione a rede **Hardhat Local**.

### 6.2 Contas de teste

Importe algumas contas do Hardhat (*Adicionar conta → Importar conta → Chave privada*), usando as chaves privadas mostradas no Terminal 1. Para testar grupos com vários membros, importe pelo menos **3 contas** (ex.: Account #0, #1 e #2).

Se o MetaMask recusar a chave, cole **sem o `0x`** do início e confira se não há espaços.

### 6.3 Ao reiniciar a blockchain local

Sempre que reiniciar o `npx hardhat node`:
1. Refaça o deploy (Terminal 2).
2. No MetaMask: **Configurações → Avançado → Limpar dados da guia de atividades**, em cada conta usada. Isso evita o erro de **nonce**.
3. Recarregue a dApp (F5).

### 6.4 Em computadores compartilhados (laboratório)

Crie uma **carteira nova** no MetaMask só para os testes, ou use um perfil de visitante no Chrome. **Nunca** importe sua carteira pessoal (frase de recuperação ou chave da conta da Sepolia) num computador compartilhado.

---

## 7. Fluxo de trabalho com Git (dupla)

### Sempre ao começar a trabalhar
```bash
git pull
```
Traz o que a dupla enviou. Se o `package.json` tiver mudado, rode `npm install` de novo.

### Ao terminar uma parte
```bash
git status                       # confere o que mudou
git add <arquivos>               # ou: git add .
git commit -m "Descrição curta do que foi feito"
git push
```

### Boas práticas
- **Commits pequenos**, um por etapa (ex.: um para o contrato, outro para os testes).
- Antes do `git add .`, confira no `git status` que **não aparecem** `node_modules`, `artifacts`, `cache` nem `.env`.
- Combinem quem está mexendo em qual arquivo, para evitar conflitos. Se der conflito no `git pull`, o Git marca os trechos com `<<<<<<<` e `>>>>>>>`: escolham a versão certa, apaguem as marcações, e façam `git add` + `git commit`.

---

## 8. Variáveis secretas (`.env`) para a Sepolia

O deploy na Sepolia precisa de duas informações **secretas**, que ficam num arquivo `.env` na raiz do projeto. Esse arquivo **nunca** vai para o Git.

### 8.1 Garantir que o `.env` está no `.gitignore`

```bash
grep -x ".env" .gitignore || echo ".env" >> .gitignore
```
O comando adiciona `.env` ao `.gitignore` caso ainda não esteja lá.

### 8.2 Criar o arquivo

Crie o arquivo `.env` na raiz com o conteúdo:
```
INFURA_API_KEY=sua_api_key_da_infura
SEPOLIA_PRIVATE_KEY=chave_privada_da_conta_de_deploy
```

- **`INFURA_API_KEY`:** em [infura.io](https://infura.io) (painel de desenvolvedor da MetaMask), na sua API key, clique em **Copy Key**. A rede **Ethereum** deve estar habilitada (a Sepolia fica dentro dela).
- **`SEPOLIA_PRIVATE_KEY`:** no MetaMask, nos detalhes da conta **de testes** com SepoliaETH, use a opção de exportar a chave privada.

> ⚠️ **Segurança:** use uma conta **só de testes**, sem ETH real. Quem tem a chave privada controla a conta em todas as redes. Nunca coloque essas chaves no código, em prints ou em mensagens.

O projeto usa `dotenv` (e não `npx hardhat vars`) porque o `vars` só existe a partir do Hardhat 2.19, e o boilerplate usa o 2.12.5. A configuração da rede Sepolia no `hardhat.config.js` será adicionada na etapa de deploy.

### 8.3 SepoliaETH

Para fazer deploys e transações na Sepolia, a conta precisa de SepoliaETH (ETH de teste, sem valor real). Se um integrante da dupla tiver saldo, pode simplesmente enviar uma parte para o outro pelo MetaMask, na rede Sepolia.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `You are using a version of Node.js that is not supported by Hardhat` | Node 20 com Hardhat 2.12.5 | Pode ignorar, ou usar `nvm use 18`. |
| `Error HH601: Script scripts/deploy.js doesn't exist` | Comando rodado dentro de `frontend/` | Voltar para a raiz: `cd ..` |
| `npm error Missing script: "start"` | `npm run start` rodado na raiz | Rodar dentro de `frontend/` |
| `SyntaxError` ao digitar `npx ...` no console | Você está dentro do console do Hardhat (`>`) | Digitar só JavaScript, ou sair com `.exit` |
| dApp fica "carregando" para sempre | MetaMask em outra rede, ou contrato perdido após reiniciar o node | Selecionar a rede Hardhat Local; refazer o deploy e recarregar |
| Erro de **nonce** ao enviar transação | Blockchain local reiniciada | MetaMask → Configurações → Avançado → Limpar dados da guia de atividades |
| "Connect Wallet" não faz nada / MetaMask não abre | Extensão do MetaMask travada | Reiniciar o navegador; se persistir, desligar e religar a extensão em `chrome://extensions` |
| `MetaMask encountered an error` (Firefox) | Bug da janela de aprovação no Firefox | Desbloquear o MetaMask antes de conectar, reiniciar o navegador, ou usar o Chrome |
| Site conectado com a conta errada | A conta nova não foi autorizada para o site | No rodapé do MetaMask, clicar em **Conectar** para a conta atual |
| `fatal: No configured push destination` | Repositório sem remoto | `git remote add origin <URL>` e `git push -u origin main` |
| `remote: Repository not found` no push | URL errada, ou repositório privado sem autenticação | Conferir com `git remote -v`; usar o Personal Access Token como senha |