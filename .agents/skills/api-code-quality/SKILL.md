---
name: api-code-quality
description: Use when changing, reviewing, or refactoring backend code in the AI Meeting Execution API.
---

# API Code Quality

Read the API `AGENTS.md`, relevant source, callers, and canonical OpenAPI/specs before changing behavior.

## Implementation

- Keep controllers thin and services cohesive around one feature responsibility.
- Validate request DTOs at the HTTP boundary. Keep database scope tied to the authenticated account.
- Use Prisma transactions for related state changes. Preserve lock order and unique constraints.
- Use shared `TimeUnitMs` and `ApiErrorCode` values. Do not add dependencies when the current stack already covers the need.
- Preserve response status, body, cookies, and error codes during refactors unless the request authorizes a contract change.
- Do not log credentials, tokens, personal meeting data, or raw provider payloads.
- Organize feature code by responsibility: `application/<endpoint>/` contains one `<endpoint>.service.ts` and its `index.ts` import gate; `guards/` contains authorization; `services/` contains cohesive operations shared across endpoints.
- Give folders an `index.ts` import gate when other folders consume their exports. Cross-folder imports go through the gate, not internal implementation paths.
- Use TypeScript path aliases (`#common`, `#database`, `#modules`, `#auth`, `#email`, `#workers`) for common cross-feature imports. Map aliases to folder `index.ts` files; `rewrite-aliases.mjs` rewrites emitted imports during build for Node runtime.
- Preserve `.ts` on relative imports; TypeScript config enables `allowImportingTsExtensions` and rewrites relative extensions for output.
- Swagger UI is served at `/docs`; root `openapi.yaml` is the contract source. Keep it aligned with authorized API changes.

## Refactoring and review

1. Identify the concrete defect or maintenance cost.
2. Trace callers, DTOs, OpenAPI behavior, database relations, and transaction boundaries.
3. Make the smallest cohesive change. Keep unrelated behavior out of the diff.
4. Review the diff for data loss, authorization regressions, exposed data, and contract drift.
5. Run only checks authorized for the task. State what those checks do and do not prove.

## Reference

This guidance adapts the user's supplied coding-quality prompt to the NestJS/Prisma API. It does not copy source from the external repositories listed in that prompt.
