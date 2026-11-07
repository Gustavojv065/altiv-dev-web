# ALTIVE DEV Extension v0.3 — client-owned API and GitHub pilot

## Flow
1. ALTIVE owner creates 30-day one-use license in `/admin/licencas` after reviewing a SaaS account.
2. Client installs the MV3 unpacked extension in Chrome/Edge desktop. Chrome Android **does not support** standard installation.
3. Extension sends the access code over HTTPS to `POST /api/extension/device/activate`. The endpoint reuses PR #22's atomic `redeem_altiv_extension_code` and returns an opaque session token.
4. `POST /api/extension/device/status` validates the session hash, license revocation/expiry and account status **on each protected action**. No Supabase login cookie or user credentials are exposed.
5. Client connects **own** OpenAI/Gemini API key plus a fine-grained GitHub PAT restricted to selected repositories. These are kept in `chrome.storage.session`; never sent to ALTIVE backend.
6. Client picks an existing text file, requests an AI rewrite, reviews full content, makes GitHub commits on an isolated branch, and optionally creates a PR. No limit is imposed by ALTIVE on commits; GitHub/API provider limitations still apply.

## Commercialization gates
- These endpoints require the PR #22 SQL migration to be installed on the **correct** Supabase project. Merging code does not migrate the database. Do not apply to production before validating a staging database.
- Ensure Vercel server-side `SUPABASE_SERVICE_ROLE_KEY` is set. Do not expose it via `NEXT_PUBLIC_`.
- Add rate limiting / WAF to the public activation endpoint and audit logs before providing customer licenses.
- Check staging behavior: activation, same code in parallel, revoked and expired license, suspended account, CORS origin, fake token, no secrets in logs.
- Run test build/CI and compare the branch against existing production workflows.
- To commercialize at scale, replace session-stored GitHub PATs with a least-privileged GitHub App, and move sensitive provider credentials to encrypted server-side storage where justified.
- **Consumer login**: ChatGPT login/plan sharing needs official OpenAI partner authorization; Google login is identity only and does not automatically include Gemini API usage. Both are intentionally disabled in the pilot.
- Current extension is **single-file editing per request**, not an unrestricted filesystem execution agent; automatic merge and direct production deploy are intentionally not provided.

## Files
The downloadable extension package is delivered separately as `ALTIVE-DEV-Extension-v0.3.zip`, containing `extension/`, tests, and standalone source for these server routes.
