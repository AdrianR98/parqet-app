# Parqet API Field Audit

Status: Phase 1 audit guide

## Purpose

This document tracks the privacy-safe API field audit for the Global Asset Timeline foundation.

The audit checks which fields, IDs, activity types and structural data are available from the Parqet Connect integration before the Global Asset Timeline pipeline is implemented.

The audit must not contain real user values.

## Route

Development-only route:

```text
GET /api/parqet/audit/fields
```

Enable locally with:

```text
ENABLE_PARQET_AUDIT_ROUTES=true
```

Production behavior:

```text
404 Not Found
```

Development behavior when disabled:

```text
403 AUDIT_ROUTE_DISABLED
```

Missing Parqet connection:

```text
401 PARQET_AUTH_REQUIRED
```

## Privacy rules

Allowed audit output:

- field names
- value types
- nesting structure
- source counts
- array counts
- enum-like activity type names and counts
- presence/absence flags
- candidate field names
- high-level warnings

Forbidden audit output:

- real portfolio names
- real asset names
- real account or user identifiers
- real ISIN/WKN/ticker values from private data
- real amounts
- real quantities
- real dates or min/max dates
- raw API payloads
- credentials/session material
- private screenshots or exports

Do not copy route responses into this file unless every entry is checked to be value-redacted.

## Output structure

The route returns an object with these top-level groups:

```text
generatedAt
environment
sources
activityTypes
fieldPresence
candidateIds
candidateValueFields
transferIndicators
warnings
nextSteps
```

Sources:

```text
portfolios
activities
holdingsOrAssets
```

Each source should include:

```text
available
count
topLevelFields
fieldTree
sampleShape
note, if unavailable or limited
```

## Manual evaluation checklist

After running the route locally, evaluate the output without committing private values:

- [ ] Portfolio fields inspected.
- [ ] Activity fields inspected.
- [ ] Holdings/assets availability checked.
- [ ] Stable portfolio ID candidates identified.
- [ ] Stable activity ID candidates identified.
- [ ] Stable asset ID candidates identified.
- [ ] ISIN/WKN/ticker/symbol candidate fields identified.
- [ ] Activity type names reviewed.
- [ ] Buy/sell/dividend/deposit/withdrawal/transfer candidates reviewed.
- [ ] Fee, tax, gross/net, amount, price and currency candidate fields reviewed.
- [ ] Transfer indicators reviewed as candidates only.
- [ ] Sensitive field warnings reviewed.
- [ ] Missing source groups documented.
- [ ] Findings below contain no real values.

## Findings

### Portfolios

Status: TODO after local audit run.

Non-private findings to record:

- available: TODO
- count: do not record exact count here unless needed and non-sensitive
- top-level field groups: TODO
- likely stable ID fields: TODO
- missing or unclear fields: TODO

### Activities

Status: TODO after local audit run.

Non-private findings to record:

- available: TODO
- activity type categories observed: TODO, type names only if non-private
- likely stable ID fields: TODO
- asset identity candidate fields: TODO
- portfolio reference candidate fields: TODO
- quantity/amount/price candidate fields: TODO
- gross/net/fee/tax/currency candidate fields: TODO
- transfer/deposit/withdrawal indicators: TODO
- missing or unclear fields: TODO

### Holdings / Assets

Status: not available in P1-1 unless a safe existing internal source is found.

Non-private findings to record:

- availability: TODO
- source: TODO
- limitation: TODO

## How this feeds the ADR

The audit findings should inform the Global Asset Timeline ADR:

- canonical asset identity strategy
- activity normalization model
- stable ID strategy
- transfer detection constraints
- dividend/tax/fee/currency representation
- warning and confidence model
- what cannot be known from Parqet API data alone

## Known non-goals for this audit

- No Global Asset Timeline implementation.
- No production UI.
- No dashboard changes.
- No transfer matching.
- No external FX or market-data API.
- No real data committed.
