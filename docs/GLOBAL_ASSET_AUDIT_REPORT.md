# Global Asset Audit Report

Status: Phase 1 audit/report guide

## Purpose

The Global Asset audit report is a guarded development-only inspection path for the isolated Phase-1 Global Asset pipeline.

It runs:

```text
ParqetActivityWithPortfolioContext[]
-> normalizeActivities()
-> buildGlobalAssetsFromNormalizationResult()
-> createGlobalAssetAuditReport()
```

The report exists to validate the new pipeline before any product UI or existing route is replaced.

## Route

Local route:

```text
/api/parqet/global-assets/audit
```

The route is hard-blocked in production and requires:

```text
ENABLE_GLOBAL_ASSET_AUDIT_ROUTES=true
```

The route must never return raw Parqet payloads.

## Query parameters

Supported parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `includeActivities` | `true` | Includes redacted normalized activities. |
| `includeAmounts` | `false` | Includes money values when explicitly enabled. |
| `includePortfolioNames` | `false` | Includes real portfolio names when explicitly enabled. |
| `includeActivityIds` | `false` | Includes source/internal activity IDs when explicitly enabled. |
| `portfolioIds` | empty | Comma-separated portfolio IDs. |
| `portfolioId` | empty | Repeatable portfolio ID parameter. |
| `limit` | `100` | Limits returned activities/assets where practical. |

Defaults are data-saving. Portfolio names are redacted to `Portfolio 1`, `Portfolio 2`, etc. Activity IDs and amounts are hidden unless explicitly requested.

## Example local calls

Minimal local call:

```text
http://localhost:3000/api/parqet/global-assets/audit
```

Include amounts and portfolio names locally:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeAmounts=true&includePortfolioNames=true
```

Filter portfolios:

```text
http://localhost:3000/api/parqet/global-assets/audit?portfolioIds=portfolio_demo_1,portfolio_demo_2
```

Do not paste real output into issues, pull requests, docs or screenshots.

## Report shape

Top-level fields:

- `generatedAt`
- `environment`
- `sources`
- `normalization`
- `aggregation`
- `warnings`
- `summary`
- `privacy`
- `nextSteps`

The combined summary is count-only and contains no private values.

## Privacy rules

- Raw payloads are never returned.
- ISINs are included by default because they are central to the audit.
- Portfolio names are redacted by default.
- Activity IDs are redacted by default.
- Amounts are redacted by default.
- Query parameters can opt into more detail for local debugging only.

## Non-goals

P1-6 does not implement:

- product dashboard integration,
- product UI,
- existing route replacement,
- cost-basis calculation,
- market-value calculation,
- unrealized PnL calculation,
- transfer pairing,
- metadata enrichment,
- FX conversion,
- test framework setup.

## Next step

Use this report to inspect Global Asset output locally. Later Phase-1 work should refine transfer handling, warnings/confidence and the decision for when the isolated pipeline becomes productive.
