# Local Metadata Maintenance Workflow

Status: v1 local metadata workflow  
Scope: asset display names, symbols, WKN values, subtitles and logo fallbacks

This document describes how to maintain local asset metadata safely for v1. It is documentation-only. It does not introduce external metadata calls, provider calls, new persistence, a metadata editing UI or private data handling.

## Purpose

Local asset metadata improves display quality when provider-loaded assets or activities only include an identifier such as an ISIN, WKN, ticker or incomplete holding label.

The local metadata workflow is allowed to improve UI display fields such as:

- asset display name,
- symbol / ticker,
- WKN,
- subtitle fallback,
- logo fallback identity.

It must not change calculations such as positions, quantities, cost basis, dividends, fees, taxes, performance or warnings.

The calculation identity and metadata boundary is defined in `docs/ASSET_IDENTITY_AND_METADATA.md`. Local metadata is display-only and must not repair missing or invalid calculation identity, alter aggregation, raise confidence, clear warnings or unblock metrics.

## Source Priority

v1 display fallback order is:

1. already loaded provider/read-model data when it contains a usable non-identifier name,
2. local/static metadata generated from a safe local CSV or maintained seed,
3. browser-local metadata cache used by local UI helpers,
4. symbol / ticker,
5. WKN,
6. ISIN.

ISIN-only labels are expected only when no better safe local metadata exists.

## Current Implementation

The current metadata flow is:

```text
data/<local source CSV>
→ scripts/generate-asset-metadata-from-csv.mjs
→ src/lib/generated/csv-asset-metadata.ts
→ src/lib/generated/csv-asset-metadata-report.ts
→ src/lib/asset-metadata.ts
→ src/lib/asset-display.ts and local read models
```

The generated metadata is merged with the optional `LOCAL_METADATA_SEED` in `src/lib/asset-metadata.ts` and a browser-local cache. Display helpers then prefer local/enriched names over identifier-only labels.

## Allowed Local Source File

A local source CSV may be used only as a maintenance input on a developer machine.

Minimum expected CSV columns for the current generator:

| Column | Required | Description |
| --- | --- | --- |
| `identifier` | yes | ISIN-like asset identifier. Must normalize to a valid ISIN. |
| `holdingname` | yes | Human-readable asset or holding name. Must not be empty or placeholder text. |

The current generator expects a semicolon-separated CSV and writes TypeScript output files under `src/lib/generated/`.

## Safe Example

A safe synthetic CSV example looks like this:

```csv
identifier;holdingname
IE00B4L5Y983;iShares Core MSCI World UCITS ETF USD Acc
IE00B8GKDB10;Vanguard FTSE All-World High Dividend Yield UCITS ETF USD Dis
US5949181045;Microsoft Corp.
```

Do not use example rows that reveal your real portfolio composition unless that composition is already intentionally public and safe to commit. Prefer synthetic or broadly non-sensitive examples in docs and tests.

## Generation Command

Run the generator locally after placing the approved CSV in the expected local path used by the script:

```bash
node scripts/generate-asset-metadata-from-csv.mjs
```

Then review the generated files before committing:

```text
src/lib/generated/csv-asset-metadata.ts
src/lib/generated/csv-asset-metadata-report.ts
```

The report should be checked for:

- total rows,
- usable rows,
- unique ISINs,
- skipped rows with missing identifiers,
- skipped rows with invalid identifiers,
- skipped rows without holding names,
- conflicting ISIN names.

Conflicts must be reviewed manually before committing generated metadata.

## What May Be Committed

Allowed when reviewed:

- generated metadata files containing ISIN-to-display-name mappings,
- generated validation report with aggregate counts and conflict summaries,
- synthetic documentation examples,
- local-only metadata workflow documentation.

## What Must Not Be Committed

Never commit:

- `.env` or `.env.local`,
- access tokens, refresh tokens, cookies, OAuth codes or authorization headers,
- private portfolio exports,
- raw provider payloads,
- account/depot screenshots,
- files containing real portfolio IDs or broker/account identifiers,
- debug dumps that include private rows or raw API responses,
- local cookie jars or local audit files under `.local/`.

When in doubt, keep the source CSV local and commit only reviewed generated metadata that contains no private account, broker, portfolio or transaction context.

## Validation Checklist

Before committing metadata changes:

- Confirm the source CSV remains local and is not staged.
- Confirm generated metadata contains only safe asset-level identifiers and display names.
- Confirm no portfolio IDs, account IDs, broker account numbers, quantities, prices, trades, dividends or transaction dates are included.
- Confirm generated report counts look plausible.
- Confirm conflicts were reviewed.
- Run or request relevant checks for the PR scope.
- Spot-check Dashboard, Activities, Timeline and Asset Detail labels when practical.

## API Budget And Privacy Rules

This workflow is local-only and provider-call-free.

Do not add automatic metadata lookups for v1. Any future use of a provider asset-search, identifier-mapping or external metadata API must be handled as a separate Research/ADR or Post-V1 feature with explicit review of:

- authentication and secret storage,
- API request budget and rate limits,
- server-side caching,
- privacy and data minimization,
- failure behavior,
- no client-side secret exposure,
- no calls triggered by normal navigation, filtering, sorting or rendering.

## Logo Fallbacks

Asset logos are separate from textual metadata. The app may derive a logo URL from the ISIN when rendering an asset logo fallback. Textual metadata maintenance does not require storing logo files or calling a metadata API.

## Review Guidance

Metadata workflow PRs should state:

- whether source CSV files remain local and uncommitted,
- what generated files changed,
- whether conflicts were reported,
- whether API Budget Impact is `none`,
- whether Privacy/Data Impact was reviewed,
- which local surfaces were spot-checked.

Keep this workflow conservative until a later ADR explicitly approves a broader metadata service or UI-based metadata editor.
