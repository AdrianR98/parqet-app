# Asset Identity And Metadata Boundary

Status: DP-03 locked boundary for #248 / #252

Scope: Global Asset calculation identity, provider identifiers, display metadata, identity warnings, confidence and blocked metrics

## Purpose

This document defines which identifiers may be used for Global Asset calculation identity and where display metadata stops.

It is documentation-only. It does not authorize runtime behavior changes, route migration, provider/API calls, new scopes, durable storage, metadata API integration, UI changes, calculation changes or fallback identity implementation.

## Decision Summary

ISIN remains the only active calculation merge key for security-like Global Asset aggregation.

Current policy:

- Valid ISIN is the only active key that may merge security-like activities into one Global Asset.
- Missing, invalid or non-ISIN identity cases must warn and lower confidence or block affected metrics.
- WKN, Parqet asset ID, holding ID, `externalId`, ticker/symbol, name, local CSV metadata and manual keys are not active calculation keys in this issue.
- Fallback categories may be documented and modeled as future candidates only.
- Name/ticker-only matches are display or audit hints, not calculation identity.
- Cash and cash-like records must not be merged into security-like Global Assets through name, ticker, symbol or metadata.
- Local metadata may improve display labels only. It must not repair calculation identity or alter warnings, confidence or blocked metrics.

## Identity Categories

### Calculation Identity

Calculation identity is the key used to merge normalized activities into a Global Asset and calculate derived asset-level facts.

For security-like Global Assets, the active calculation identity is:

| Key | Current status | Calculation use |
| --- | --- | --- |
| ISIN | Active | May merge security-like activities when valid and present. |
| WKN | Future candidate only | Must not merge activities yet. |
| Parqet asset ID | Future candidate / provider reference only | Must not merge activities yet. |
| Holding ID | Provider holding context only | Must not merge across portfolios or holdings yet. |
| `externalId` | Provider reference only | Must not merge activities yet. |
| Ticker / symbol | Display/audit hint only | Must not merge activities. |
| Name / display label | Display/audit hint only | Must not merge activities. |
| Local CSV metadata | Display metadata only | Must not change calculation identity. |
| Manual key | Future candidate only | Must not merge activities until a separate decision defines review, storage and rollback. |

### Provider Identity

Provider identity is identifier context supplied by Parqet or provider-shaped read models. It may help with audit, source tracking, diagnostics and future fallback design, but it is not automatically calculation identity.

Examples:

- holding ID,
- Parqet asset ID,
- `externalId`,
- provider asset type,
- provider holding nickname or logo,
- provider asset labels.

Provider identifiers may be preserved as context in normalized models and warnings. They must not silently merge Global Assets unless a later decision promotes a specific identifier into an active key with false-merge handling, confidence rules, privacy review and migration evidence.

### Display Metadata

Display metadata is label enrichment for already identified assets or local UI presentation.

Allowed display-only uses:

- display name,
- symbol or ticker,
- WKN subtitle,
- logo identity fallback,
- local UI labels,
- display diagnostics.

Display metadata must not change:

- quantities,
- aggregation,
- position status,
- cost basis,
- realized or unrealized PnL,
- dividends,
- fees,
- taxes,
- FX,
- warnings,
- confidence,
- blocked metrics.

Display metadata must not trigger Parqet, provider asset-search, identifier-mapping, logo, market-data, FX or external metadata calls.

## Current Global Asset Behavior

Current Global Asset normalization derives `assetIdentity.assetKey` only from a valid ISIN. The implementation trims and uppercases the observed ISIN candidate and applies the current Phase-1 simple ISIN validation before creating:

```ts
{ type: "isin", value: "<ISIN>" }
```

Current aggregation groups activities by:

```text
assetKey.type + ":" + assetKey.value
```

Activities without an `assetKey` are not aggregated into a Global Asset. They remain unassigned and produce warnings. Current aggregation display metadata is temporary: name is the key value, subtitle is the key type, and symbol/logo/metadata source are `null`.

The type model already contains future key variants such as `wkn`, `parqet_asset_id` and `manual`, but those variants are model capacity only. They are not active calculation keys under this decision.

## Allowed Identifier Inputs

| Input | Current status | Notes |
| --- | --- | --- |
| Valid ISIN | Active calculation key | Only active merge key for security-like Global Assets. |
| Missing ISIN | Identity gap | Normalize what is safe, warn, leave unassigned for Global Asset aggregation and block affected metrics. |
| Invalid ISIN | Identity gap | Warn, do not derive `assetKey`, leave unassigned and block affected metrics. |
| WKN | Display/future fallback candidate | Useful as subtitle or audit context; false-merge risk across markets/share classes means it is not active. |
| Parqet asset ID | Provider reference/future candidate | May be stable inside provider context but needs cross-portfolio semantics, lifecycle behavior and privacy review before use. |
| Holding ID | Provider holding context | Holding-level identity can be portfolio-specific and must not imply global asset identity. |
| `externalId` | Provider reference/future candidate | Semantics must be verified before any calculation use. |
| Ticker or symbol | Display/audit hint | Ambiguous across exchanges, currencies and share classes; not active. |
| Asset or holding name | Display/audit hint | Ambiguous and mutable; not active. |
| Local CSV metadata | Display-only | May enrich labels for an existing identifier; must not repair calculation identity. |
| Manual key | Future candidate only | Requires separate user-decision model, auditability, storage, rollback and confidence policy. |

## Fallback Candidates And Risks

Fallback identity is not implemented by this issue. Later work may consider fallback candidates only after an explicit decision defines their scope, review path and metric impact.

| Candidate | False-merge risk | False-split risk | Why not active yet |
| --- | --- | --- | --- |
| WKN | Different instruments or share classes may appear similar without full exchange/currency context. | Same security may be missing WKN on some records. | Needs source verification, normalization rules and conflict handling. |
| Parqet asset ID | Provider semantics may differ between portfolios, deleted assets or provider lifecycle changes. | Same security could appear under multiple provider IDs. | Needs OpenAPI/runtime evidence and migration comparison. |
| Holding ID | Holdings are usually position/portfolio scoped, not global asset scoped. | Transfers or re-created holdings may split the same security. | Suitable as context, not global identity. |
| `externalId` | Semantics are not locked and may reference provider-specific or integration-specific objects. | Same instrument could have missing or changed external IDs. | Needs contract evidence before use. |
| Ticker/symbol | Tickers collide across exchanges and can be reused or currency-specific. | Same security can have multiple tickers. | Too ambiguous for calculation merging. |
| Name/display label | Names change and may be localized, abbreviated or duplicated. | Same security can have many names. | Display-only; unsafe for calculations. |
| Manual key | User input can over-merge unrelated assets. | Missing or inconsistent manual decisions can split assets. | Needs reviewed decision model, storage, undo and audit path. |
| Local metadata | Metadata can be stale, incomplete or generated from private local sources. | Metadata may exist for only some records. | Display-only and provider-call-free by design. |

## Cash And Cash-Like Identity

Cash, deposits, withdrawals, interest, cash balances, cash-like synthetic holdings and provider cash placeholders are not security-like Global Assets under this policy.

Cash-like records must not be merged into security-like Global Assets through:

- name,
- ticker,
- symbol,
- WKN,
- local metadata,
- provider logo or display label.

Current activity types such as `deposit`, `withdrawal`, `interest`-like provider inputs and transfer-like cash movements may still be normalized or preserved as event context when supported by the pipeline, but they must not become security identity. If cash Global Assets are later supported, they need a separate typed identity policy that defines currency, account/portfolio scope, cash balance behavior, transfer semantics, confidence and blocked metrics.

## Missing, Invalid And Conflicting Identifiers

Missing active identity:

- create a user-safe warning such as missing ISIN or missing asset key,
- do not create a security-like Global Asset calculation key,
- keep the activity or record available for audit when safe,
- lower confidence for affected outputs,
- block metrics where false merging or false splitting would mislead users.

Invalid active identity:

- create a user-safe invalid identifier warning,
- preserve the raw candidate only where safe and redacted enough for diagnostics,
- do not normalize it into an active calculation key,
- lower confidence and block affected metrics.

Duplicate or conflicting identity:

- same valid ISIN across portfolios may merge as one security-like Global Asset,
- same valid ISIN with conflicting names, symbols, WKNs or logos is a display conflict, not a split by itself,
- different valid ISINs with the same name, ticker or WKN must remain separate calculation identities,
- one provider holding with multiple conflicting identifier candidates must warn and avoid fallback merging unless a later rule explicitly resolves the conflict,
- duplicate activity IDs or duplicate provider references remain activity/audit warnings and must not be used to merge unrelated assets.

## Corporate Actions And Historical Names

This policy does not solve mergers, spin-offs, ISIN changes, historical names, ticker changes or provider backfills.

Current behavior should be conservative:

- different ISINs remain different calculation identities,
- historical names and ticker changes are display/audit context only,
- local metadata may improve the current label but must not bridge old and new instruments,
- metrics that require corporate-action continuity must remain blocked or low-confidence until a separate corporate-action identity decision exists.

## Confidence And Blocked Metrics

Identity gaps must affect confidence.

Minimum policy:

- valid ISIN with no material identity warnings may be high confidence for identity-dependent grouping, subject to other source/freshness warnings,
- missing or invalid ISIN lowers confidence and blocks position, portfolio breakdown and cost-basis style metrics when aggregation would require a merge key,
- conflicting non-ISIN hints lower confidence for display/audit interpretation but must not split or merge active ISIN groups by themselves,
- name/ticker-only matches remain audit hints and do not raise confidence enough to unblock calculation metrics,
- cash-like records without a separate typed identity policy remain blocked for security-like aggregation.

Affected metrics should use `blockedMetrics` when showing the value as complete would risk a false merge, false split or misleading total. Later read models should carry `source`, `freshness`, `confidence`, `warnings` and `blockedMetrics` consistently with the provider data-source strategy.

Warnings must be user-safe and privacy-safe. They may describe missing, invalid or ambiguous identity categories, but they must not expose tokens, cookies, private provider payloads, private export rows, raw account structure or unredacted private activity data.

## Privacy And Data Constraints

This boundary is structural and must stay privacy-safe.

Do not access, copy, summarize or include:

- `.env*`,
- cookies,
- OAuth codes,
- access tokens or refresh tokens,
- authorization headers,
- private Parqet exports,
- raw provider payloads,
- real portfolio, depot, account, activity, holding or transaction data,
- screenshots with private data,
- private local metadata source files,
- ignored local private paths such as `.local/`.

Documentation examples must be synthetic or structural. Real private holdings must not be used as examples. Public identifiers that already appear in public docs may remain only when they are clearly non-private examples.

## Later Implementation Prerequisites

Before any fallback calculation key can become active, a later issue must document and verify:

- exact source field and provider contract evidence,
- normalization rules and validation,
- false-merge and false-split handling,
- duplicate/conflict behavior,
- warning codes and blocked metric mapping,
- confidence derivation,
- source/freshness/read-model propagation,
- API budget impact, including request count/scope, cache behavior, retry and rate-limit behavior,
- privacy/data impact,
- old/new comparison evidence against existing behavior,
- rollback or compatibility projection,
- no hidden provider calls from navigation, filtering, rendering or metadata display,
- no local metadata behavior change unless separately authorized.

Fallback identity, cash identity, corporate-action identity, provider metadata lookup, external asset search, identifier mapping, logo services, market data and FX are all separate future decisions.

## Related Issues And Docs

- Refs #248
- Refs #249
- Refs #251
- Fixes #252
- Related: #253, #255, #256, #258, #259, #260
- `docs/PIPELINE_INVENTORY.md`
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`
- `docs/GLOBAL_ASSET_TYPE_MODEL.md`
- `docs/GLOBAL_ASSET_NORMALIZATION.md`
- `docs/GLOBAL_ASSET_AGGREGATION.md`
- `docs/LOCAL_METADATA_WORKFLOW.md`
- `docs/V1_GUARDRAILS.md`
