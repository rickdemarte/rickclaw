# RickClaw

RickClaw é um agente pessoal em `Node.js + TypeScript`, com execução local e foco em automação, produtividade e interação multimodal. Ele expõe duas interfaces principais:

- bot do Telegram
- web chat local com autenticação

O modo recomendado de operação deste projeto é via Docker.

## Stack

- `Node.js 20`
- `TypeScript`
- `Express`
- `SQLite` com `better-sqlite3`
- `grammy` para Telegram
- `groq-sdk` para Groq
- SDKs para OpenAI, Gemini e DeepSeek
- `Vitest`
- `Docker Compose`

## Componentes principais

- `src/app.ts`: bootstrap e shutdown
- `src/core/agent-controller.ts`: orquestração principal
- `src/core/agent-loop.ts`: loop ReAct
- `src/interfaces/webchat-api.ts`: API e web chat
- `src/interfaces/telegram-input-handler.ts`: entrada via Telegram
- `src/persistence/`: SQLite, repositórios e lockfile
- `context/`: persona, perfil, instruções e memória
- `.agents/skills/`: skills dinâmicas

## Providers

Providers disponíveis:

- `gemini`
- `openai`
- `deepseek`
- `groq`

Tiers atuais do Groq:

- `light`: `openai/gpt-oss-20b`
- `default`: `openai/gpt-oss-120b`
- `heavy`: `openai/gpt-oss-120b`

## Estrutura

```text
.
├── .agents/skills/
├── context/
├── data/
├── public/
├── src/
├── tests/
├── tmp/
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Configuração

O projeto usa `.env`. Há também um `ENV_SAMPLE` como referência.

Variáveis importantes:

- `PORT`
- `DEFAULT_PROVIDER`
- `MAX_ITERATIONS`
- `MEMORY_WINDOW_SIZE`
- `JWT_SECRET`
- `WEB_CHAT_USERNAME`
- `WEB_CHAT_PASSWORD`
- `TELEGRAM_ALLOWED_USER_IDS`
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `GROQ_API_KEY`
- `LOCK_HOST_ID`

Observações:

- no Docker, `LOCK_HOST_ID` deve ser estável
- sem `JWT_SECRET`, sessões do web chat expiram após restart
- o usuário inicial do web chat é bootstrapado no banco se ainda não existir

## Rodando com Docker

Subir:

```bash
docker compose up --build
```

Subir em background:

```bash
docker compose up --build -d
```

Parar:

```bash
docker compose down
```

Logs:

```bash
docker compose logs -f
```

Status:

```bash
docker compose ps
```

Padrões atuais:

- porta: `3128`
- healthcheck interno: `GET /health`
- volumes persistidos: `data`, `tmp`, `context`, `.agents/skills`

## Rodando sem Docker

```bash
npm install
npm run dev
```

Outros comandos:

```bash
npm run build
npm test
npm run reset-password
npm run release-lock
```

## Web Chat

Rotas principais:

- `GET /health`
- `GET /status`
- `POST /api/auth`
- `POST /api/chat/stream`
- `POST /api/chat/clear`
- `POST /api/chat/upload`
- `GET /api/costs`
- `POST /api/auth/change-password`
- `GET /api/files/download_tmp`

Comportamento:

- autenticação por JWT
- resposta do chat via SSE
- upload de PDF, `.md` e `.txt`

## Telegram

O bot:

- usa polling
- valida whitelist por `TELEGRAM_ALLOWED_USER_IDS`
- aceita texto, documento e voz

Comandos básicos:

- `/new`
- `/history`
- `/session <ID>`

## Lockfile e persistência

O projeto usa `data/.keepuniq` para proteger o SQLite.

Regras atuais:

- o lock armazena host lógico, PID e timestamp
- no Docker, o host lógico precisa ser estável
- em ambiente de teste, a checagem de lock é ignorada

Banco principal:

- `data/rickclaw.db`

## Troubleshooting

### Restart loop por lockfile

```bash
npm run release-lock
docker compose up --build
```

Também verifique `LOCK_HOST_ID`.

### Token do web chat invalida após restart

Defina `JWT_SECRET`.

### Tool calling instável no Groq

O projeto já usa fallback parser para pseudo-function calls em texto, mas o comportamento depende do modelo. O melhor resultado atual foi com `openai/gpt-oss-120b` no tier `default`.
