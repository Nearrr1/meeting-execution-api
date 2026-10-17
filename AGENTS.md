# API Coding Conventions

Follow workspace `AGENTS.md` and canonical specs. Keep this repository independent from web and specs repositories.

## Structure

- `src/modules/<feature>` owns a feature. Put each API use case in `application/<endpoint>/` with `<endpoint>.command.ts`, `<endpoint>.endpoint.ts`, `<endpoint>.handler.ts`, and an `index.ts` import gate. Keep HTTP mapping in endpoint classes and request data in command constructors. Each handler should depend on exactly one service. Put shared auth operations behind `AuthService`; place logic used only by one API in that use case's folder. Keep authorization in `guards/`.
- Each folder that is imported from outside itself has an `index.ts` barrel as its import gate. Import through that gate; avoid reaching into another folder's implementation file.
- `src/common` contains shared transport concerns and cross-feature constants.
- `src/database` contains Prisma lifecycle and transaction helpers. Prisma schema and migrations remain in root `prisma/`.
- `src/workers` contains background jobs. Keep each batch's database changes in one transaction.
- `src/main.ts` owns application bootstrap only.

## Backend rules

- Each HTTP endpoint is a small Nest controller class in its use-case folder. It validates/maps transport input and dispatches a command to its handler. Keep business rules and database access in cohesive services. Avoid endpoint-local forwarding wrappers; use `AuthService` for shared operations and a use-case-local service for API-specific logic.
- Preserve OpenAPI behavior during refactors. Validate external input through DTOs.
- Derive account scope from the authenticated session. Use transactions for multi-row lifecycle changes.
- Use `TimeUnitMs` for durations. Keep API error identifiers in `ApiErrorCode` and avoid leaking internal exceptions.
- Never log passwords, OTPs, session secrets, recovery tokens, provider tokens, or meeting content.
- Prefer small cohesive services and existing dependencies.
- Use the configured TypeScript path aliases (`#common`, `#config`, `#database`, `#modules`, `#auth`, `#email`, `#workers`) for cross-feature shared imports. Map each alias to that folder's `index.ts`; `rewrite-aliases.mjs` rewrites emitted aliases for Node runtime.
- Validate runtime environment variables centrally in `src/config` before bootstrapping the Nest application. Keep secrets out of logs and configuration error messages.
- Email delivery and quota providers are owned and exported by `EmailModule`; feature modules import it instead of registering those providers directly.
- OIDC transaction state, nonce, and PKCE verifier are one-use and short-lived; sensitive transaction material must be encrypted at rest and never logged.
- Keep `.ts` extensions on relative TypeScript imports. `allowImportingTsExtensions` and `rewriteRelativeImportExtensions` are configured so emitted JavaScript uses `.js` paths.
- Keep Swagger UI mounted at `/docs` and treat root `openapi.yaml` as the API contract source. Update it when an authorized API contract changes.
- Refactor in small steps. Inspect callers and persistence effects first; report unverified behavior honestly.

## Existing checks

- `npm run typecheck` checks TypeScript without emitting files.
- `npm run build` creates the NestJS production build.
- `npm test` builds the app and runs the Node.js built-in test runner against `test/`.
- `npm run format` applies the shared Prettier config to source and tests; `npm run format:check` verifies formatting.
- Do not claim runtime behavior is verified by type checking or building.
