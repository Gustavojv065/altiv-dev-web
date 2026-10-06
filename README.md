# ALTIV DEV Web v0.2

AI-first website/app builder designed around a chat + preview workspace.

## Current foundation

- Next.js 16 + React 19
- Vercel AI SDK 7 architecture
- Auto model routing by task
- Agent pipeline: understand → plan → memory → generate → validate → preview → browser test → commit → deploy
- Supabase-ready Auth/database/vector memory structure
- GitHub/Vercel integration boundaries
- Desktop/mobile preview shell

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add only the credentials you need. Never expose service-role, GitHub, or provider secrets in `NEXT_PUBLIC_*` variables.

## Deployment

Push this repository to GitHub and import it into Vercel. The root directory is the repository root and the framework is Next.js.

## Architecture principle

ALTIV DEV does not blindly copy public builders. It combines compatible ideas from strong open-source ecosystems while keeping the core implementation controlled, auditable and replaceable.
