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

## Agent Engine v0.4

This branch adds a Mobile-Agent-inspired execution layer without copying the mobile UI wholesale.

### Skill routing
ALTIV keeps a broad skill catalog but activates only the skills relevant to the current request. Core skills always enforce safe repository analysis and verification before completion.

Included groups:
- Core: safe edit, repository analysis, verification
- Web: premium design, responsive design, React/Next.js, CSS/Tailwind, SEO, conversion
- Backend: Supabase, API/security
- Git/deploy: GitHub workflow, Vercel/deploy
- Quality: TypeScript, systematic debugging, tests, code review, accessibility
- Agent: planning, brainstorming, parallel-agent guidance, skill creator
- Mobile: PWA, Expo Router, Expo native client

### AI routing
The server can be configured with one or more providers:
- OpenRouter, including `openrouter/free` for free-first routing
- OpenCode Zen, including compatible free coding models
- OpenAI via the Responses API
- Gemini
- NVIDIA
- Vercel AI Gateway remains a fallback

The routing rule is **free-first with fallback**: only configured providers are attempted, and paid/BYOK providers can take over when a free route is unavailable or fails.

### Security
Provider secrets and GitHub credentials stay server-side. The provider status endpoint returns capabilities/configuration state only and never returns API keys. For commercial GitHub access, GitHub App/OAuth installation tokens should replace long-lived personal access tokens.

