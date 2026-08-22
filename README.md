# Upy — API & Website Monitor

## O que resolve

Ferramenta no estilo UptimeRobot: você cadastra URLs de API ou site e um worker verifica disponibilidade e tempo de resposta sozinho. Quando o serviço cai, abre incidente e dispara alerta. Quando volta, fecha o incidente.

## Como pode ser usado

Monitoramento local de endpoints de um projeto, health checks de APIs de portfólio, ou sandbox pra estudar worker + Postgres + dashboard. Não é SaaS multi-tenant: um Postgres, uma API, um worker.

## Tecnologias

- Bun + Hono + TypeScript
- PostgreSQL + Drizzle ORM
- React + Vite + coss UI
- Docker Compose
- Alertas: Discord/webhook via HTTP; e-mail via SMTP (opcional)

## Funcionalidades

- CRUD de monitores (nome, URL, método, intervalo, timeout, status esperado)
- Worker separado executando health checks
- Histórico: status HTTP, latência, erro, horário
- Incidentes: abre no down, fecha no up
- Dashboard: status, uptime, latência, histórico, incidentes
- Alertas por e-mail, Discord ou webhook (só na abertura/fechamento de incidente)
- Check manual pelo dashboard

## Como rodar

### Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d --build
```

- Dashboard: http://localhost:5173
- API: http://localhost:3000
- Postgres: localhost:5432 (`upy` / `upy` / `upy`)

### Sem Docker

1. Suba um Postgres e aponte `DATABASE_URL`
2. `cd server && bun install && bun run src/index.ts`
3. Outro terminal: `cd server && bun run src/worker.ts`
4. `cd web && bun install && bun run dev`

SMTP: sem `SMTP_HOST` o canal e-mail só loga no worker. Com Mailhog, `SMTP_HOST=mailhog` e porta `1025`.

## Estrutura do projeto

```
server/src/index.ts       API Hono
server/src/worker.ts      loop de checks
server/src/lib/health.ts  up / incidente / vencimento
server/src/lib/run-check.ts persistência + alerta
web/src/App.tsx           dashboard
docker-compose.yml        db + api + worker + web
index.html                vitrine GitHub Pages
```

## Testes

Self-check da regra de negócio (sem rede, sem Postgres):

```bash
cd server && bun install && bun bin/check.ts
```

Cobre: up/down pelo status esperado, abrir/fechar incidente, intervalo due, validação de URL/canal, payload de Discord/webhook.

## Demonstração

| Método | Rota | Efeito |
|--------|------|--------|
| `GET` | `/api/monitors` | lista |
| `POST` | `/api/monitors` | cria |
| `GET` | `/api/monitors/:id` | detalhe + stats + checks + incidentes |
| `POST` | `/api/monitors/:id/check` | check na hora |
| `POST` | `/api/monitors/:id/alerts` | cadastra alerta |

Body de criação:

```json
{
  "name": "httpbin",
  "url": "https://httpbin.org/status/200",
  "method": "GET",
  "intervalSeconds": 60,
  "timeoutMs": 5000,
  "expectedStatus": 200
}
```

## Licença

MIT
