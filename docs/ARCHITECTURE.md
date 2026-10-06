# ALTIV DEV — Architecture v0.1

Core flow: Prompt → Planner → Context/Memory → Code Agent → Sandbox → Validator → Browser/Preview → Git Commit → Vercel Deploy.

## Services
- Next.js web shell: chat, project explorer, preview, logs, version history.
- AI Router: per-task provider ranking with fallback and budget controls.
- Tool layer: GitHub, Vercel, Supabase, browser/debug tools, MCP-compatible tools.
- Sandbox: isolated code execution; prefer Vercel Sandbox or E2B for commercial deployment.
- Memory: user/workspace/project/session scopes; semantic retrieval and summarized decisions.
- Observability: structured action log, token/cost tracking, errors, retries, build/test outcomes.

## Safety boundaries
- Never expose service-role keys to browsers.
- Every public Supabase table uses RLS.
- Generated code executes only in an isolated sandbox.
- Production deployment requires a successful validation gate.
- External repository code is adopted only after license/dependency review.
