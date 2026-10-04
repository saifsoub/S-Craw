# S-Craw — plain-language README

## What this is
A shared text editor where several people can write in the same document at the same time and see each other's changes as they type, like Google Docs. Documents use Markdown, a simple way to add headings and formatting with plain text.

## Who it's for
Teams who want to write documents together in real time.

## What it does today
- Live editing together, merging everyone's changes without anyone having to "lock" the document.
- User login (`/api/auth/...`).
- Create, open, edit and delete documents (`/api/documents/...`).
- A health check at `GET /health`.
- Stores documents in a PostgreSQL database and also uses Supabase, a hosted database and login service.

## How to run it
You need Docker.
1. Copy `.env.example` to `backend/.env` and `frontend/.env`.
2. Fill in the settings: the port, the allowed website address, the Supabase address and public key, the database login details and a `JWT_SECRET` (a long random password used to sign logins).
3. Start everything:
   ```bash
   docker compose up --build
   ```

The server runs on port 4000 and the database on port 5432.

## Current status and known gaps
- The website part is set to publish automatically to GitHub Pages.
- Where the live server is hosted: not yet confirmed.

## Where things live
| Folder / file | What's in it |
|---|---|
| `backend/` | Server: live sync, login, documents |
| `frontend/` | The editor website |
| `docker-compose.yml` | Starts the database, server and website together |
| `.github/workflows/` | Automatic website build and publishing |
