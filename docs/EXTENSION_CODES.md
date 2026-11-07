# ALTIVE DEV Extension — access by code (pilot)

## Confirmed existing base
The ALTIV DEV Web already has Next.js, Supabase Auth, SaaS accounts, plan management and a protected super-admin.
The main branch had **no implemented license code issuance**, so this feature is an isolated addition.
The original /login and /workspace authentication are unchanged.

## Flow
1. Super-admin signs in at /login and opens /admin/licencas.
2. Selects a SaaS account and issues a 30-day cryptographically random access code.
3. Code is displayed exactly once and stored only as SHA-256 hash.
4. Customer opens /extension in a normal browser, enters code; no Termux or email needed.
5. A single-use code is atomically redeemed, and an HttpOnly, SameSite=Strict session cookie is issued.
6. The admin can revoke the license; suspension, expiration and revocation are checked on each page load.

## Limitations / production gates
- **Login gateway only**: this does not yet authorize /workspace, GitHub changes, model providers or the previous stand-alone v0.2 extension. Those require a tested integration.
- New migration `20261107170000_altiv_extension_license_access.sql` requires manual staging review and must be applied only to the correct Supabase project. This PR does not run migrations in production.
- Ensure server-only SUPABASE_SERVICE_ROLE_KEY at hosting; do not use NEXT_PUBLIC_ for server secrets.
- Place /extension behind production rate limiting / WAF and secure HTTPS before commercial launch. High-entropy codes mitigate guessing but do not replace abuse protection.
- Each code activates one device exactly once; send new code for a second device.
- Test real redeem, simultaneous redeem, expired code, revoked code, suspended account, logout, RLS and responsive layout using staging before merge.
- No ChatGPT/Gemini consumer-login or shared subscription is implemented.
- Local crypto tests: `node --experimental-strip-types --test tests/license.test.mjs`
