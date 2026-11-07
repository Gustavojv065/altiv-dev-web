# ALTIVE DEV Extension — Phase 2 / client workspace

## What is implemented
- `/extension/workspace`: a client with an activated license can see ONLY projects explicitly linked to that SaaS account AND owned by its owner.
- Clients can submit a bounded change request. The new SQL function verifies the server-side session, license, active account, project ownership, and 10 requests per account per UTC day **inside a serialized transaction**.
- `/admin/extension-projetos`: super-admin can map an existing project to its own owner's SaaS account. Never maps a project belonging to another owner or transfers it from an existing account.
- `/admin/solicitacoes`: the super-admin can view requests and mark them `in_review` or `rejected`. No code is executed, and no GitHub or Vercel action is triggered.
- Shared license sessions do not expose secrets. Request history is isolated by license ID. Unauthenticated visitors are redirected.

## Hard release gates — NOT safe to merge as an enabled commercial feature yet
1. In the identified **STAGING** Supabase project, review and apply `20261107170000_altiv_extension_license_access.sql` from PR #22, then `20261107190000_altiv_extension_requests.sql` from this PR. These migrations are NOT applied automatically and no production database was touched.
2. Validate 2 simultaneous activations of one code; revoked/expired/suspended license; 2 unrelated client accounts; project cross-account attempted submission; request count 10/11 and parallel submissions; project owner mismatch; role checks; forged session; no direct access to the tables as anon/authenticated.
3. Ensure Vercel preview uses STAGING Supabase only. Never point a preview at a production service_role.
4. Validate tablet/phone login form and /extension/workspace. Verify no live prompts or secrets are logged.
5. Add production-grade login abuse rate limiting; HTTPS cookie security is already required. Confirm owner/provider GitHub permissions **before enabling agents**.

## Future (not implemented)
- Approved AI editing execution with cost accounting.
- GitHub App repository-scoped installation, isolated branch/PR, Vercel preview, human approval.
- Official ChatGPT/Google login only when provider authorization permits.
- Device management and license renewal.
