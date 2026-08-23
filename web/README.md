# Upy — Web Dashboard

Interface web do Upy para gerenciamento de monitores, visualização de status em tempo real, Kanban de cards e histórico de incidentes.

## Stack

- **React 19** + **TypeScript**
- **Vite** (bundler rápido)
- **Tailwind CSS v4** + **Base UI**
- **Lucide React** (ícones)
- **Oxlint** (linter ultra-rápido)

## Como rodar

### Desenvolvimento local

```bash
bun install
bun run dev
```

Acesse em `http://localhost:5173`.

### Build de produção

```bash
bun run build
```

Gera os assets otimizados no diretório `dist/`.

### Linting

```bash
bun run lint
```

## Variáveis de ambiente

Crie um arquivo `.env` baseado nas configurações desejadas:

```env
VITE_API_URL=http://localhost:3000
```

