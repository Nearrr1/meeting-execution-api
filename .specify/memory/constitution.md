# AI Meeting → Execution Engineering Constitution

This file is a local agent-guidance copy. The canonical constitution is in the sibling `meeting-execution-specs` repository at `.specify/memory/constitution.md`; keep this copy aligned with it. It does not define product behavior that has not yet been specified.

## 1. Specification before implementation

Use the workflow `constitution → specification → clarification → plan → tasks → implementation → verification`. Follow `Product Idea → PRD → SRS → Architecture → Database Design → API Contract → Implementation → Tests → Deployment → Integration → E2E`. Do not skip specification because a feature appears simple. When a requirement is ambiguous, identify it, make and document only the smallest safe assumption if it does not affect architecture or product behavior, and request clarification when it does.

## 2. Repository and service boundaries

The API, web client, and specifications are three independent repositories. The API owns application APIs, persistence, and business rules. The web client consumes the public API and never connects directly to the backend database. The specifications repository owns product/SRS and cross-repository architecture documents. Keep the code repositories independently deployable.

## 3. API contract

The backend is the source of truth for application APIs. Version REST routes under `/api/v1`; plan OpenAPI documentation at `/docs`. The web client reads its API base URL from `NEXT_PUBLIC_API_URL`; do not hardcode deployment URLs. Configure backend CORS for local development, deployed frontend origins, and future preview environments.

## 4. Data, tenancy, and security

Design for multi-tenancy, authentication, authorization/RBAC, auditability, and tenant isolation. Validate inputs and enforce authorization at service or domain boundaries. Never trust AI-provided identifiers, permissions, tenant IDs, user IDs, or tool arguments without server-side validation. Keep secrets out of Git and load them through environment configuration. Use secure defaults and record important mutations for auditability.

## 5. AI proposals and memory

Keep AI providers behind an abstraction so business logic is provider-independent; prefer structured output. AI-generated summaries, decisions, action items, and risks are proposals until explicitly approved by a user. Never trigger irreversible external side effects from unverified AI output. PostgreSQL is the authoritative transactional store; pgvector supports semantic retrieval; Hindsight is long-term agent memory and is not a replacement for PostgreSQL. Define the exact integration later.

## 6. Architecture and code quality

Keep clear module boundaries and dependency injection. Use strict TypeScript, validated DTOs, typed API responses, centralized error handling, structured logging, and startup environment validation. Avoid unjustified `any`, oversized controllers or services, business logic in controllers, direct database access from controllers, duplicated API models, secrets in source, and provider-specific AI logic in domain services. Keep architecture documentation and diagrams aligned with implemented decisions. Archify and Huashu, if used, remain documentation/showcase tools and not runtime dependencies.

## 7. Verification and operations

Add meaningful automated tests for important business flows as they are implemented; optimize for useful coverage, not test count. Prepare for observability and background jobs without implementing them during bootstrap. Separate development, test, and production configuration. Keep each logical phase independently reviewable and use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`, and `ci:`.

## 8. Cost and dependency choices

Target $0/month during MVP development where realistic. Prefer local development, open-source tools, free tiers, optional integrations, provider abstraction, and graceful degradation. Document optional paid upgrades separately and introduce a paid dependency only when it has a clear architectural benefit.

## 9. Agent and architecture changes

Coding agents must follow repository specifications and must not silently change architecture. If implementation conflicts with a specification, stop, describe the conflict and impact, propose a change, update the specification and an ADR, then continue.

## 10. Bootstrap scope

Bootstrap creates repository structure and engineering documentation only. Authentication, data models, API endpoints, AI integrations, UI screens, Hindsight, Redis, BullMQ workers, and external integrations require later phases and approved specifications.
