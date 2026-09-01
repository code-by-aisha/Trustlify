# Trustlify Backend

Production Node.js/Express/TypeScript backend foundation for Trustlify — an evidence-driven AI investigation platform.

## Stack

- **Node.js** + **Express** — HTTP server
- **TypeScript** — type safety
- **Zod** — request validation
- **Helmet** — security headers
- **express-rate-limit** — rate limiting

Future phases add: Supabase, Model Studio / Qwen, React Flow.

## Install

```bash
cd backend
npm install
```

## Run

### Development (with hot reload)

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

## Test

```bash
npm test
```

## Lint (type-check only)

```bash
npm run lint
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | No (default: `development`) | `development`, `production`, `test` |
| `PORT` | No (default: `3000`) | Server port |
| `FRONTEND_ORIGIN` | No (default: `http://localhost:5173`) | CORS allowed origins — comma-separated strict allowlist, never `*` |
| `SUPABASE_URL` | Phase 2 | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Phase 2 | Supabase anon key |
| `SUPABASE_SECRET_KEY` | Phase 2 | Supabase service role key |
| `DASHSCOPE_API_KEY` | Phase 3 | Alibaba Model Studio API key |
| `MODEL_STUDIO_BASE_URL` | Phase 3 | Model Studio endpoint |
| `MODEL_STUDIO_PRIMARY_MODEL` | Phase 3 | Primary reasoning model |
| `MODEL_STUDIO_FAST_MODEL` | Phase 3 | Lower-cost fast model |

## API Structure

### Public endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

### Protected endpoints (require authentication)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/profile` | Create/update student profile |
| `GET` | `/api/profile` | Get current user's profile |
| `POST` | `/api/investigations` | Create investigation |
| `POST` | `/api/investigations/:id/start` | Start investigation pipeline |
| `GET` | `/api/investigations/:id` | Get investigation state |
| `POST` | `/api/investigations/:id/recheck` | Re-check investigation |
| `POST` | `/api/investigations/:id/monitor` | Start monitoring |
| `POST` | `/api/uploads` | Upload metadata validation |
| `GET` | `/api/history` | List user's investigations |
| `GET` | `/api/monitoring` | List monitoring items |

## Project Structure

```
backend/src/
  server.ts              — Entry point, Express setup
  config/env.ts          — Environment validation
  middleware/
    errorHandler.ts      — Centralized error handling
    requestId.ts         — Request tracing
    auth.ts              — Authentication (Supabase in Phase 2)
    rateLimit.ts         — Rate limiting
  routes/                — Express route handlers
  services/              — Business logic layer
  validators/            — Zod schemas for input validation
  ai/                    — AI provider interface + Model Studio
  investigation/         — Investigation pipeline modules
  engines/               — Trust, Risk, Currentness, Student Match
  types/                 — TypeScript type definitions
  utils/                 — Logger, URL safety utilities
```

## Phases

1. **Backend Foundation** (this phase) — architecture, security, validation, interfaces
2. **Supabase + Auth + RLS + Storage**
3. **Model Studio AI integration**
4. **Investigation pipeline**
5. **Trust Engine + Student Match + Risk**
6. **Frontend integration**
7. **Monitoring + deployment**

See `docs/BACKEND_PHASE_MAP.md` for details.
