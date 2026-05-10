# Parqet App

Parqet App is a Next.js application for working with authorized Parqet portfolio data. The repository is currently in Phase 0: establishing the collaboration, documentation, prompt, template and CI baseline before further product work continues.

English is the source of truth for repository documentation. German translations may exist as placeholders until a later Translation-Agent PR provides full translations.

## Current Scope

The app already contains Parqet OAuth routes, dashboard and activities views, Parqet API route handlers, local metadata enrichment concepts, reconciliation warnings and override-oriented audit workflows. Phase 0 does not redesign or extend those product features.

Important guardrail: do not create a second activity or asset pipeline before Phase 1 explicitly decides otherwise. Work touching Parqet data must respect the existing pipeline direction and document architectural changes through ADRs.

## Documentation

- [AGENTS.md](AGENTS.md) - short entrypoint for Codex and future agents.
- [prompts/master-prompt.yaml](prompts/master-prompt.yaml) - compact operative master rules.
- [prompts/master-prompt.md](prompts/master-prompt.md) - human-readable prompt explanation.
- [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) - workflow, branch, review and verification rules.
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) - current repository status and next steps.
- [docs/PROJECT_PRODUCT_BRIEF.md](docs/PROJECT_PRODUCT_BRIEF.md) - product idea and Phase-1 questions.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Phase-0 architecture note.
- [docs/ASSETTRACE_V1_GUARDRAILS.md](docs/ASSETTRACE_V1_GUARDRAILS.md) - AssetTrace v1 data, API-budget and analytics-safety guardrails.
- [docs/PHASE_PLAN.md](docs/PHASE_PLAN.md) - phase plan.
- [docs/ROADMAP.md](docs/ROADMAP.md) - longer-term roadmap and governance.
- [docs/adr/](docs/adr) - architecture and collaboration decision records.

German placeholders:

- [README.de.md](README.de.md)
- [docs/DEVELOPMENT_WORKFLOW.de.md](docs/DEVELOPMENT_WORKFLOW.de.md)

## Local Development

Requirements:

- Node.js
- npm
- Parqet Connect client configuration for local OAuth testing

Install dependencies:

```bash
npm install
```

Create a local environment file from the example and fill it locally only:

```bash
cp .env.example .env.local
```

Do not commit real `.env` files, tokens, cookies, OAuth codes, refresh tokens, private Parqet exports, screenshots with real portfolio data, or local reference files.

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run generate:asset-metadata
```

Phase 0 CI runs `npm run lint` and `npm run build`. A test script is not part of this Phase-0 baseline and must not be added here.

## Pull Requests

Normal work should use branch plus pull request. `main` should remain stable. Adrian may intentionally commit directly to `main` for small, low-risk documentation changes, but direct `main` commits are not intended for app code, auth, API contracts, data pipeline, CI, security, architecture, or large prompt/documentation changes.

Every PR should state whether Codex was involved, what was intentionally not changed, verification results, risks and rollback. See [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

## Security And Privacy

- No real tokens.
- No real `.env` files.
- No private Parqet exports.
- No real portfolio or depot data.
- No screenshots with real portfolio, account, depot or personal data.
- No cookies, OAuth codes, access tokens or refresh tokens in Issues, PRs or logs.
- No debug logs containing private API responses.
- Private local reference files may exist only in ignored paths such as `.local/`.
- `.env.example` may contain empty placeholders only.
- Anonymized real data requires manual approval by Adrian.
- Synthetic test data is allowed only in clearly named test folders.
- If private data appears in a diff, the PR is blocked.
- Auth, API and token changes require Full Review.
