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
| `includeActivities` | `false` | Includes redacted normalized activities only when explicitly enabled. |
| `includeAmounts` | `false` | Includes money values only when explicitly enabled. |
| `includePortfolioNames` | `false` | Includes real portfolio names only when explicitly enabled. |
| `includeActivityIds` | `false` | Includes source/internal activity IDs only when explicitly enabled. |
| `portfolioIds` | empty | Comma-separated portfolio IDs. |
| `portfolioId` | empty | Repeatable portfolio ID parameter. |
| `limit` | `20` | Limits returned arrays and nested timelines where practical. |

Defaults are data-saving. Portfolio names are redacted to `Portfolio 1`, `Portfolio 2`, etc. Portfolio IDs are pseudonymized to `portfolio_1`, `portfolio_2`, etc. Holding IDs, activity IDs, source IDs, source-bearing sort keys and amounts are hidden unless explicitly requested.

## Example local calls

Minimal local call:

```text
http://localhost:3000/api/parqet/global-assets/audit
```

Small report with a low array limit:

```text
http://localhost:3000/api/parqet/global-assets/audit?limit=5
```

Include activities locally, still redacted:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeActivities=true&limit=5
```

Include amounts and portfolio names locally:

```text
http://localhost:3000/api/parqet/global-assets/audit?includeAmounts=true&includePortfolioNames=true&limit=5
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
- `warningsTruncated`
- `summary`
- `privacy`
- `nextSteps`

The combined summary is count-only and contains no private values.

Returned arrays include truncation flags, for example:

- `normalization.activitiesTruncated`
- `normalization.warningsTruncated`
- `aggregation.assetsTruncated`
- `aggregation.unassignedActivitiesTruncated`
- `aggregation.warningsTruncated`
- `aggregation.timelinesTruncated`
- top-level `warningsTruncated`

## Privacy rules

- Raw payloads are never returned.
- ISINs are included by default because they are central to the audit.
- Portfolio names are redacted by default.
- Portfolio IDs are pseudonymized by default.
- Holding IDs are redacted by default.
- Activity IDs are redacted by default.
- Sort keys are rebuilt so they do not leak source activity IDs by default.
- Amounts are redacted by default.
- Query parameters can opt into more detail for local debugging only.

## Parqet reauthorization note

Parqet Connect authorization can be scoped to the portfolios granted during the OAuth consent flow. If portfolios were added, renamed or appear to be missing, revoke the integration in Parqet and connect again through:

```text
http://localhost:3000/api/auth/start
```

Then select all current portfolios during consent.

## avgHoldingPeriod unit

Observed Parqet activity payloads can expose `avgHoldingPeriod` as a large millisecond value. The normalization layer stores `avgHoldingPeriodDays`, so obvious millisecond values are converted to days.

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
