# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint

docker compose up -d                   # Start PostgreSQL (port 5433)
docker compose down -v                 # Stop and delete DB data

npx prisma migrate dev --name <name>   # Create and apply a migration
npx prisma generate                    # Regenerate Prisma client after schema changes
npx prisma studio                      # Open DB browser UI
```

## Architecture

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 7 · PostgreSQL · NextAuth v5 (Auth.js beta)

### Key constraints

- **Prisma 7** requires a driver adapter — the client is never instantiated without `PrismaPg`. The schema datasource has no `url` field; connection URL is passed via the adapter in `src/lib/prisma.ts`. The `prisma.config.ts` supplies the URL for migrations via `datasource.url`.
- **Prisma generated client** outputs to `src/generated/prisma/`. Import from `@/generated/prisma/client` (not the directory root). This path is gitignored; run `prisma generate` after cloning.
- **Port conflict**: a native Windows PostgreSQL occupies port 5432. The Docker container is mapped to **5433**. `DATABASE_URL` must use port 5433.
- **PostgreSQL auth**: container uses `POSTGRES_HOST_AUTH_METHOD: trust` (no password required for host connections).
- **NextAuth sessions** use JWT strategy (not database sessions) because the Credentials provider is incompatible with database-backed sessions in Auth.js v5.

### Auth flow

`src/lib/auth.ts` — exports `{ handlers, auth, signIn, signOut }` from NextAuth. The `authorize` callback verifies passwords with bcrypt (cost 12).

`src/app/api/auth/[...nextauth]/route.ts` — mounts the NextAuth handlers.

`src/app/api/auth/register/route.ts` — `POST` endpoint for account creation; validates, checks email uniqueness, hashes password, inserts user.

`src/app/auth/signin/page.tsx` and `src/app/auth/register/page.tsx` — client components for auth UI.

### Data layer

`src/lib/prisma.ts` — singleton `PrismaClient` using `PrismaPg` adapter, cached on `globalThis` for hot-reload safety in dev.

Schema models: `User` (with nullable `password` for future OAuth providers), `Account`, `Session`, `VerificationToken` — standard NextAuth schema.

## Environment variables

```
DATABASE_URL=postgresql://quiz:quiz@localhost:5433/quiz?schema=public
AUTH_SECRET=<generate with: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
```
