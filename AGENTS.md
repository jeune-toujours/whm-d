# WHM D

## Current architecture

The authoritative specification is the Notion master plan dated 2026-10-04:
https://app.notion.com/p/3ef75fc615c881808c1fdcd5ffb69ea6

- Existing Svelte 5 / JavaScript client stays at the repository root.
- TypeScript Payload backend belongs in `backend/`.
- Payload Admin and custom warehouse views provide backoffice.
- Managed PostgreSQL and S3 in Selectel hold persistent data in Russia (owner update 2026-10-04).
- Payload Jobs handles integrations and retries. No Redis, Celery or WebSockets.
- Coolify runs applications on the existing VM.
- `develop` deploys staging; `main` deploys production after checks.
- Client accesses WHM API only. MySklad is accounting integration, not product master.

## Implementation

- Preserve the current UI system, themes and neutral media placeholders.
- Use only `@lucide/svelte` icons in the client.
- Object ownership and role permissions must be enforced on the server.
- Never commit credentials or log secrets, OTP codes or card details.
- Schema changes require migrations. Production never uses schema push.
- Keep audit/event history for critical operations and make integrations idempotent.
- Do not invent tariff, legal or payment rules: record missing decisions explicitly.

## Verification

Frontend: `npm run check`, `npm run build`, `npm run test:flows`.
Backend: run backend typecheck, tests and build when backend changes.
Verify deployed health and commit identity before reporting a release as successful.
