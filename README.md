# AI Meeting → Execution API

Backend repository for the AI Meeting → Execution product. The backend will own authentication, authorization, tenant-scoped application data, business rules, background processing, persistence, and the public API contract. It is intended to deploy independently from the web client.

## Status

Bootstrap only. Product behavior, API endpoints, database models, and runtime services have not been implemented. Requirements must be specified and reviewed before implementation.

## Repository boundaries

- Public API base path: `/api/v1`.
- OpenAPI documentation is planned at `/docs`.
- The backend is the source of truth for application APIs and persistent application state.
- PostgreSQL is the planned authoritative transactional store. Redis, BullMQ, pgvector, AI providers, Hindsight, and external integrations remain future architecture topics.
- AI-generated content is a proposal until a user approves it. Do not trigger irreversible external actions from unverified output.

## Documentation

Product requirements, SRS, cross-repository architecture, and ADRs live in the sibling `meeting-execution-specs` repository. The API owns and implements the public API contract; its planned OpenAPI documentation is served at `/docs`.

## Local setup and commands

There is no runnable application or dependency manifest in this bootstrap. Development commands, environment variables, tests, and deployment instructions will be added after the corresponding requirements and implementation are approved.

Copy `.env.example` to `.env` only when a later phase defines the required variables. Never commit `.env`, credentials, or API keys.

## Development workflow

Follow the canonical constitution in `meeting-execution-specs/.specify/memory/constitution.md` and the approved specs. Open `AI-Meeting-Execution.code-workspace` to work with all three independent repositories. Resolve specification conflicts explicitly and record approved architecture changes in an ADR.
