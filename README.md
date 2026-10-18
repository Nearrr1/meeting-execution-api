# AI Meeting → Execution API

Backend repository for the AI Meeting → Execution product. The backend will own authentication, authorization, tenant-scoped application data, business rules, background processing, persistence, and the public API contract. It is intended to deploy independently from the web client.

## Status

The NestJS API implements local registration, email OTP verification/resend, sign-in, password recovery/reset, local and federated reauthentication, password and email changes, OIDC identity linking, cookie sessions, account disablement, internal support-assisted reactivation, 30-day deletion scheduling, CSRF protection, and session inspection/revocation. A PostgreSQL-locked API worker purges due account data and retains a minimal tombstone. Provider tenant setup and live OIDC validation remain deployment gates.

## Repository boundaries

- Public API base path: `/api/v1`.
- OpenAPI source is [`openapi.yaml`](openapi.yaml), served interactively at `/docs`.
- The backend is the source of truth for application APIs and persistent application state.
- PostgreSQL is the planned authoritative transactional store. Redis, BullMQ, pgvector, AI providers, Hindsight, and external integrations remain future architecture topics.
- AI-generated content is a proposal until a user approves it. Do not trigger irreversible external actions from unverified output.

## Documentation

Product requirements, SRS, cross-repository architecture, and ADRs live in the sibling `meeting-execution-specs` repository. The API owns and implements the public API contract; its planned OpenAPI documentation is served at `/docs`.

## Local setup and commands

The application requires Node.js 24 LTS and pnpm 11.25.0. Enable Corepack, install dependencies with `pnpm install --frozen-lockfile`, configure `.env`, generate Prisma Client with `pnpm db:generate`, apply local migrations, then start the development server with `pnpm start:dev`. The OpenAPI contract is at `http://localhost:3000/docs`. Browser clients must first fetch `/api/v1/auth/csrf-token` with credentials, then send the returned token in `X-CSRF-Token` on mutating requests.

## Production rollout

Deploy and validate this API before configuring the web app's production base URL. The hosting provider and production database are still undecided in the canonical deployment architecture, so a live deployment cannot be completed until those targets and their secret configuration are selected. The generic release sequence is: install from `pnpm-lock.yaml`, generate Prisma Client, build, apply migrations with `pnpm db:migrate:deploy`, and start with `pnpm start`. Configure `WEB_ORIGINS`, secure production cookies, `PASSWORD_RESET_URL`, `EMAIL_CHANGE_URL`, Resend, and the OIDC callback against the deployed web/API origins before enabling production auth flows.

The API application is still a bootstrap. Hindsight is installed separately as a local development service and may be used now as project memory for the AI coding assistant, retaining curated architecture/spec context across sessions. It is not wired into API requests; the Phase 1 product workflow remains independent of Hindsight. End-user Second Brain integration is a later Phase 2 feature. The OpenAI configuration below applies only to this local Hindsight service; it does not select the product's meeting-analysis provider.

On Windows, install the standalone Hindsight API in an isolated environment from this repository root:

```powershell
uv venv .hindsight-venv --python 3.12 --cache-dir .uv-cache
uv pip install --python .hindsight-venv\Scripts\python.exe -r requirements-hindsight.txt --cache-dir .uv-cache
```

To start it from PowerShell, run the launcher below from the API repository root. It prompts for the key without echoing it and exposes only bank creation plus retain/recall/reflect through MCP.

```powershell
powershell -ExecutionPolicy Bypass -File .\start-hindsight.ps1
```

The API listens on `http://127.0.0.1:8888`. The server uses Hindsight's local embedded database by default. Keep provider credentials in an untracked secret store or process environment; do not put them in this repository. The Hindsight API package, its data, and local uv cache are excluded from Git. Installation alone creates no project-memory bank or product meeting memory. To make memory available to Codex, connect its MCP client to the local Hindsight MCP endpoint and create/seed a project bank; those steps are not configured by installing the API. Store only curated, non-secret project context; the specifications repository remains the source of truth and should be checked before relying on recalled details.

The workspace registers the local MCP endpoint in `.codex/config.toml`. Start the Hindsight service first, then reload/restart Codex so its `hindsight` tools become available. The root MCP endpoint supports bank management; use the `aimetingexecution-project` bank for this workspace.

For **Git Bash on Windows**, run this from the API repository root. It selects Hindsight's OpenAI Responses provider with GPT-5.4 mini and prompts for the API key without echoing it or putting it in shell history. The PowerShell launcher above additionally limits the MCP tools exposed to Codex.

```bash
export HINDSIGHT_API_LLM_PROVIDER='openai-responses'
export HINDSIGHT_API_LLM_MODEL='gpt-5.4-mini'
export HINDSIGHT_API_MCP_ENABLED='true'
export HINDSIGHT_API_MCP_ENABLED_TOOLS='create_bank,retain,recall,reflect'
export HINDSIGHT_API_MCP_INSTRUCTIONS='Use bank aimetingexecution-project for curated AI Meeting Execution architecture, specifications, ADRs, and durable project decisions. Never retain credentials, secrets, or raw meeting transcripts. Treat current specs and ADRs as authoritative; memory is supplemental.'
read -r -s -p 'OpenAI API key: ' HINDSIGHT_API_LLM_API_KEY
printf '\n'
export HINDSIGHT_API_LLM_API_KEY
./.hindsight-venv/Scripts/python.exe -c "import sys; sys.argv = ['hindsight-api', '--host', '127.0.0.1']; from hindsight_api.main import main; main()"
```

GPT-5.4 mini supports the Responses API and function calling and is a cost-efficient option for Hindsight's memory tasks ([Hindsight provider guidance](https://hindsight.vectorize.io/developer/models), [OpenAI model details and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)). OpenAI API usage is billed separately. This local Hindsight choice does not select the product's meeting-analysis provider.

The Hindsight service is a development setup only. Product integration, bank/tenant isolation, approved memory sources, retention/deletion, and authority enforcement remain subject to their Phase 2 feature specification and ADR.

Copy `.env.example` to `.env` only when a later phase defines the required variables. Never commit `.env`, credentials, or API keys.

## Development workflow

Follow the canonical constitution in `meeting-execution-specs/.specify/memory/constitution.md` and the approved specs. Open `AI-Meeting-Execution.code-workspace` to work with all three independent repositories. Resolve specification conflicts explicitly and record approved architecture changes in an ADR.
