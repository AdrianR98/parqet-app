# Parqet App

Parqet App is a Next.js Parqet Integration.

Current architecture baseline:

- Parqet OAuth is used for authorized portfolio access.
- User Portfolio Data (Parqet-derived portfolio/activity data) is cached browser-local for app views.
- `/settings` is simplified to two cards: `Parqet-Verbindung` and `Darstellung`.
- Disconnect clears Parqet auth cookies server-side and Parqet-derived browser-local data client-side, while appearance/UI preferences remain.
- Header portfolio selection is the user-facing portfolio selection path.
- Dashboard, Activities and Asset Detail can recover from missing local cache through local bootstrap/cache-change flow.
- `/admin` lives in the `(admin)` route group and is read-only for market-data inspection/triage.
- Runtime market-history reads are DB-only (`src/lib/market-data/service.ts`), with provider calls restricted to explicit Admin/CLI workflows.
- Current provider workflow is yfinance-based; OpenFIGI is optional admin lookup support.

Current operator workflow details are documented in [docs/MARKET_DATA_PIPELINE.md](docs/MARKET_DATA_PIPELINE.md).

## Documentation

- [AGENTS.md](AGENTS.md)
- [docs/LOCAL_QUICKSTART.md](docs/LOCAL_QUICKSTART.md)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/MARKET_DATA_PIPELINE.md](docs/MARKET_DATA_PIPELINE.md)
- [docs/PIPELINE_INVENTORY.md](docs/PIPELINE_INVENTORY.md)
- [docs/V1_GUARDRAILS.md](docs/V1_GUARDRAILS.md)
- [docs/AI_WORKFLOW_ADOPTION.md](docs/AI_WORKFLOW_ADOPTION.md)
- [docs/DOMAIN_LANGUAGE.md](docs/DOMAIN_LANGUAGE.md)
- [docs/DOMAIN_MODEL_BOUNDARIES.md](docs/DOMAIN_MODEL_BOUNDARIES.md)
- [docs/DATABASE_ASSET_MODEL_PLAN.md](docs/DATABASE_ASSET_MODEL_PLAN.md)
- [docs/KPI_CATALOG.md](docs/KPI_CATALOG.md)
- [docs/PRM_FIELD_LINEAGE.md](docs/PRM_FIELD_LINEAGE.md)

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```
