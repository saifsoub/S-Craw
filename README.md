# S-Craw

A real-time collaborative Markdown editor. Several people edit the same document at once and see
each other's changes live.

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, CodeMirror 6, Yjs + `y-websocket`, Zustand, TanStack Query |
| Backend | Node.js, Express, `ws`, Yjs (`y-protocols`), Supabase |
| Database | PostgreSQL 16 |
| Deploy | Docker Compose; the frontend also publishes to GitHub Pages |

Collaboration uses Yjs CRDTs over a WebSocket connection, so concurrent edits merge without a
central lock.

## Backend API

| Route | Purpose |
|---|---|
| `GET /health` | Liveness probe |
| `/api/auth/*` | Authentication |
| `/api/documents/*` | Document CRUD |
| `ws://<host>/ws` | Real-time collaboration channel |

## Run locally

```bash
docker compose up --build
```

The backend listens on `:4000` for both HTTP and WebSocket; PostgreSQL listens on `:5432`.

## Configuration

Copy `.env.example` to `backend/.env` and `frontend/.env`, then set:

| Variable | Used by |
|---|---|
| `PORT`, `CORS_ORIGIN` | backend |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | backend |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | backend |
| `JWT_SECRET` | backend |

## Layout

| Path | Purpose |
|---|---|
| `backend/` | Express + WebSocket server, Yjs sync, auth, documents |
| `frontend/` | Vite + React client with CodeMirror |
| `docker-compose.yml` | Postgres, backend, and frontend |
| `.github/workflows/` | Frontend build and GitHub Pages deploy |
