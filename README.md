# Upy — API & Website Monitor

## O que resolve

Ferramenta no estilo UptimeRobot: você cadastra URLs de API ou site e um worker verifica disponibilidade e tempo de resposta sozinho. Quando o serviço cai, abre incidente, dispara alertas e gera diagnóstico automático com IA. Quando o serviço volta, o incidente é fechado automaticamente.

## Como pode ser usado

Monitoramento local de endpoints de um projeto, health checks de APIs de portfólio ou sandbox para estudar arquitetura desacoplada (worker + Postgres + API + dashboard + IA). Não é SaaS multi-tenant: um Postgres, uma API, um worker.

## Tecnologias

- **Backend:** Bun + Hono + TypeScript
- **Banco de Dados:** PostgreSQL + Drizzle ORM
- **Inteligência Artificial:** Groq Cloud API (Llama 3.1) para diagnóstico automático de incidentes
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + Base UI + Lucide Icons
- **Deploy:** Docker Compose
- **Alertas:** Discord / Webhook via HTTP; e-mail via SMTP (opcional)

## Funcionalidades

- **Monitores:** CRUD completo (nome, URL, método HTTP, intervalo, timeout e status esperado)
- **Worker separado:** loop de execução desacoplado da API web
- **Diagnóstico por IA (Groq):** ao abrir um incidente, a IA analisa os fatos do erro e gera automaticamente um card no Kanban com causa provável e ação recomendada
- **Kanban de Cards:** quadro visual de tarefas/cards por monitor, com diferenciação visual entre cards de IA e manuais, resolução e rastreio
- **Histórico & Métricas:** status HTTP, latência, erros, percentual de uptime e média de latência
- **Incidentes:** abertura automática ao falhar e resolução automática ao normalizar
- **Alertas:** notificações para Discord, Webhooks genéricos ou E-mail (disparados na abertura e fechamento)
- **Check manual:** disparo de verificação sob demanda diretamente pelo dashboard

## Como rodar

### Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d --build
```

- **Dashboard:** http://localhost:5173
- **API:** http://localhost:3000
- **Postgres:** localhost:5432 (`upy` / `upy` / `upy`)

### Sem Docker

1. Suba uma instância PostgreSQL e configure `DATABASE_URL` no `.env`
2. Configure opcionalmente `GROQ_API_KEY` para ativar a criação automática de cards por IA
3. Inicie a API:
   ```bash
   cd server && bun install && bun run src/index.ts
   ```
4. Em outro terminal, inicie o worker:
   ```bash
   cd server && bun run src/worker.ts
   ```
5. Inicie a interface web:
   ```bash
   cd web && bun install && bun run dev
   ```

> **SMTP:** Sem `SMTP_HOST` configurado, notificações por e-mail são registradas no log do worker. Para testes locais com Mailhog, defina `SMTP_HOST=mailhog` e porta `1025`.

## Estrutura do projeto

```
server/src/index.ts          API HTTP (Hono)
server/src/worker.ts         Worker em loop contínuo de health checks
server/src/lib/health.ts     Regras de up/down, incidentes e agendamento
server/src/lib/run-check.ts  Execução de probe, persistência e disparo de alertas
server/src/lib/groq.ts       Integração com Groq para diagnóstico automático
server/src/db/schema.ts      Esquema relacional (monitors, checks, incidents, alerts, cards)
web/src/pages/Dashboard.tsx  Dashboard interativo, Kanban e gerenciamento
web/src/pages/Home.tsx       Página inicial / vitrine
docker-compose.yml           Orquestração do ambiente completo
```

## Testes e Validação

Self-check da regra de negócio (sem dependência de banco ou rede externa):

```bash
cd server && bun run check
```

Valida: determinação de up/down por status code, transições de incidente, verificação de intervalos devidos, parsing de URLs/canais de alerta e extração estruturada de respostas do Groq.

## Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/monitors` | Lista todos os monitores |
| `POST` | `/api/monitors` | Cria um novo monitor |
| `GET` | `/api/monitors/:id` | Detalhes, estatísticas, checks, incidentes e cards |
| `PATCH` | `/api/monitors/:id` | Atualiza parâmetros do monitor |
| `DELETE` | `/api/monitors/:id` | Remove o monitor e todos os dados associados |
| `POST` | `/api/monitors/:id/check` | Executa verificação imediata |
| `POST` | `/api/monitors/:id/alerts` | Cadastra canal de alerta (discord/email/webhook) |
| `DELETE` | `/api/monitors/:id/alerts/:alertId` | Remove canal de alerta |
| `GET` | `/api/monitors/:id/cards` | Lista cards do Kanban do monitor |
| `POST` | `/api/monitors/:id/cards` | Cria card manual no Kanban |
| `PATCH` | `/api/monitors/:id/cards/:cardId` | Atualiza status/resolução do card |
| `DELETE` | `/api/monitors/:id/cards/:cardId` | Remove card |

## Licença

MIT
