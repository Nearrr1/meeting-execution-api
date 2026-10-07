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

The API application is still a bootstrap. Hindsight is installed separately as a local development service for the Phase 2 Second Brain work; it is not wired into API requests or required by the Phase 1 workflow.

On Windows, install the standalone Hindsight API in an isolated environment from this repository root:

```powershell
uv venv .hindsight-venv --python 3.12 --cache-dir .uv-cache
uv pip install --python .hindsight-venv\Scripts\python.exe -r requirements-hindsight.txt --cache-dir .uv-cache
```

To start it, set `HINDSIGHT_API_LLM_PROVIDER` and `HINDSIGHT_API_LLM_API_KEY` in the current PowerShell session using a provider you have chosen, then run:

```powershell
.\.hindsight-venv\Scripts\hindsight-api.exe --host 127.0.0.1
```

The API listens on `http://127.0.0.1:8888`. The server uses Hindsight's local embedded database by default. Keep provider credentials in an untracked secret store or process environment; do not put them in this repository. The Hindsight API package, its data, and local uv cache are excluded from Git. No memory banks or meeting data are created by installation alone.

The Hindsight service is a development setup only. Product integration, bank/tenant isolation, approved memory sources, retention/deletion, and authority enforcement remain subject to their Phase 2 feature specification and ADR.

Copy `.env.example` to `.env` only when a later phase defines the required variables. Never commit `.env`, credentials, or API keys.

## Development workflow

Follow the canonical constitution in `meeting-execution-specs/.specify/memory/constitution.md` and the approved specs. Open `AI-Meeting-Execution.code-workspace` to work with all three independent repositories. Resolve specification conflicts explicitly and record approved architecture changes in an ADR.
