# Contributing to OpenTrack

Thank you for your interest in contributing to or forking **OpenTrack**.

## Architecture Overview

OpenTrack is a full-stack TypeScript monolith built with Next.js App Router, Prisma ORM, and PostgreSQL 16.

```text
OpenTrack/
├── docker-compose.yml            # App + PostgreSQL 16 + persistent volumes
├── Dockerfile                    # Multi-stage Next.js standalone production image
├── docker-entrypoint.sh          # Auto schema push + optional idempotent seed
├── prisma/
│   ├── schema.prisma             # Database models (Workspace, Issue, TimeEntry, Notification, etc.)
│   └── seed.ts                   # Optional demo data seed
└── src/
    ├── app/
    │   ├── (auth)/               # Login & Registration pages
    │   ├── (app)/                # Authenticated workspace pages (board, inbox, cycles, views, issues, settings)
    │   ├── invite/[token]/       # Public/Auth workspace invitation acceptance flow
    │   └── api/
    │       ├── auth/             # Session auth endpoints (bcrypt + HTTP-only JWT)
    │       ├── internal/         # UI backend APIs (issues, workspaces, views, uploads, notifications, templates)
    │       ├── uploads/          # Authenticated media streaming with HTTP 206 byte-range support
    │       └── v1/               # Public REST API (Bearer / X-API-Key) for external integrations
    ├── components/               # Reusable UI components (KanbanBoard, ListView, RichMarkdownEditor, etc.)
    └── lib/                      # Shared utilities (prisma, auth, api-auth, issues, webhooks, templates, types)
```

## Local Development (Without Docker for App)

1. Start PostgreSQL 16 (or run `docker compose up -d db`).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. Install dependencies and prepare the database:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Pull Request Checklist

- Ensure `npm run build` completes with zero TypeScript or ESLint errors.
- Keep all database queries strictly scoped by `workspaceId` for multi-tenant isolation.
- Enforce role checks (`OWNER`, `ADMIN`, `MEMBER`) server-side in API routes.
- Update `prisma/schema.prisma` cleanly and ensure backward compatibility for existing deployments.
