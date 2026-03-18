# GED — Gerenciamento Eletrônico de Documentos

Open-source, self-hostable Electronic Document Management System.

**License:** AGPL-3.0
**MVP Target:** January 2027

---

## Features

- Upload and download PDF documents
- OCR processing via Tesseract (async, BullMQ)
- Full-text search (PostgreSQL FTS)
- Per-document metadata (key-value pairs)
- Expiration dates with email alerts
- Audit trail (upload, view, download, delete)
- Role-based access control (admin / editor / viewer)
- S3-compatible storage (MinIO)

---

## Quick Start (Docker Compose)

```bash
# Clone the repo
git clone <repo-url>
cd ged

# Copy environment config
cp .env.example .env
# Edit .env if needed (especially JWT secrets in production)

# Start all services
docker compose up -d

# Run DB migrations
docker compose exec api npx tsx migrations/run-migrations.ts

# Create the first admin user
docker compose exec api npx tsx scripts/seed-admin.ts
# Default: admin@ged.local / changeme123

# Open the app
open http://localhost:5173

# API docs (development only)
open http://localhost:3000/docs
```

---

## Architecture

```
Browser (React SPA)
       │
  Nginx (port 80)
  ├─ /api/* → Fastify API (port 3000)
  └─ /*     → Vite/React (port 5173)
       │              │
  PostgreSQL        MinIO (S3)
       │
  Redis + BullMQ
       │
  OCR Worker (Tesseract)
```

---

## Tech Stack

| Layer     | Technology                       |
|-----------|----------------------------------|
| Frontend  | React 18 + TypeScript + Vite     |
| Backend   | Node.js + Fastify                |
| Database  | PostgreSQL 16                    |
| Storage   | MinIO (S3-compatible)            |
| OCR       | Tesseract + pdftotext (poppler)  |
| Auth      | JWT + Refresh tokens             |
| Queue     | BullMQ (Redis-backed)            |
| Container | Docker + Docker Compose          |
| CI/CD     | GitHub Actions                   |

---

## Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# OCR Worker (separate terminal)
cd backend
npm run worker:dev
```

---

## Environment Variables

See `.env.example` for all required variables.
**Always change JWT secrets in production.**

---

## Roles

| Role    | Permissions                              |
|---------|------------------------------------------|
| admin   | Full access, manage users, view audit    |
| editor  | Upload, edit metadata, set expiry, delete|
| viewer  | View and download documents only         |

---

## Database Migrations

Migrations live in `backend/migrations/` as numbered SQL files.
Run them with:

```bash
npx tsx migrations/run-migrations.ts
```

---

## Running Tests

```bash
cd backend
npm test          # all tests
npm run test:unit # unit tests only
```

---

## Delivery Roadmap

| Phase | Scope                          | Target    |
|-------|--------------------------------|-----------|
| 0     | Setup, infra, auth             | Month 1   |
| 1     | Upload/download, storage, UI   | Months 2–3|
| 2     | OCR pipeline                   | Month 4   |
| 3     | Metadata & search              | Months 5–6|
| 4     | Audit log & expiry dates       | Months 7–8|
| 5     | Security hardening, e2e tests  | Months 9–10|
| MVP   | Deploy & homologation          | Jan 2027  |
