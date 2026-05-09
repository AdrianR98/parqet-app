# ADR 0002: Global Asset Timeline

Status: accepted
Date: 2026-05-09
Owner: AdrianR98

## Context

Phase 1 defines the core product foundation for the Parqet Integration.

The app is not intended to replace Parqet. Parqet remains the source system through Parqet Connect / OAuth. This app builds an asset-centric analysis layer that consolidates the same security across multiple authorized Parqet portfolios.

The main product value is a Global Asset Timeline:

- one global view per security across portfolios,
- complete activity history by asset,
- portfolio origin preserved,
- transfer-related activity types represented explicitly,
- dividends, fees, taxes and reference values preserved,
- warnings and confidence used where data is incomplete or ambiguous.

Phase 1 must not replace existing product calculations before audit, architecture decisions and report mode are complete.

## Runtime audit evidence

The Phase-1 API field audit was completed before this ADR.

Relevant docs and issues:

- `docs/PARQET_API_AUDIT.md`
- #57 Phase-1 parent
- #58 API field audit
- #62 ADR issue

The audit found these non-private portfolio field groups:

- `id`
- `currency`
- `name`
- `createdAt`
- `distinctBrokers`

The audit found these non-private activity field groups:

- `id`
- `type`
- `datetime`
- `currency`
- `shares`
- `price`
- `amount`
- `amountNet`
- `fee`
- `tax`
- `holdingId`
- `holdingAssetType`
- `asset`
- `asset.assetIdentifierType`
- `asset.isin`
- `realizedGains`
- `realizedGainsNet`
- `buyAmountNet`
- `avgHoldingPeriod`

The audit found these activity type categories:

- `buy`
- `sell`
- `dividend`
- `deposit`
- `withdrawal`
- `transfer_in`
- `transfer_out`
- `fees_taxes`

The audit did not find an obvious direct portfolio reference inside activity payloads. Portfolio context is therefore a fetch-layer responsibility.

Holdings/assets were not available as a separate source in the first runtime audit and remain a known gap.

## Decision

### 1. Global asset identity

Use `asset.isin` as the primary Global Asset key.

The Global Asset Timeline is asset-centric, not holding-centric. Activities with the same ISIN are candidates for the same Global Asset even if they originate from different Parqet portfolios or holdings.

Missing-ISIN fallback remains a known gap. Future fallback candidates may include WKN, Parqet IDs, ticker/name combinations or explicit override rules. This ADR does not finalize those fallbacks because the runtime audit only provided `asset.isin` as the clear security identity field.

### 2. Role of `holdingId`

Treat `holdingId` as Parqet holding context, not as the primary global merge key.

`holdingId` must be preserved in normalized activity metadata and later portfolio/holding breakdowns. It helps explain where an activity came from and can support diagnostics, but it must not prevent global consolidation by ISIN.

### 3. Portfolio context

Attach portfolio context during the fetch loop.

Every activity fetched for a portfolio must be enriched before normalization with at least:

- `portfolioId`
- `portfolioName`, when safely available
- portfolio currency or source currency metadata, when available

The normalized model must not assume that the Parqet activity payload itself contains a direct portfolio field.

### 4. Missing portfolio context

Missing portfolio context blocks portfolio-specific metrics, but not necessarily all global inspection.

If an activity has sufficient asset identity and value/quantity data but no portfolio context, the app may still show it in global audit/timeline output. However, portfolio breakdowns, portfolio-specific cost basis, portfolio-specific PnL and transfer matching that requires portfolio origin must be blocked or marked incomplete.

### 5. Activity normalization boundary

Raw Parqet activities must be normalized before Global Asset aggregation.

A later `NormalizedActivity` model must preserve:

- activity ID (`id`),
- activity type (`type`),
- activity datetime (`datetime`),
- asset identity (`asset.isin`, `asset.assetIdentifierType`),
- holding context (`holdingId`, `holdingAssetType`),
- portfolio context from the fetch layer,
- numeric fields (`shares`, `price`, `amount`, `amountNet`, `fee`, `tax`),
- currency,
- Parqet reference fields (`realizedGains`, `realizedGainsNet`, `buyAmountNet`, `avgHoldingPeriod`).

The normalization boundary is required so later aggregation does not depend directly on raw API objects.

### 6. Explicit transfer types

Represent `transfer_in` and `transfer_out` as explicit transfer-related timeline activity types.

Do not implement automatic pair matching as part of this ADR. Correct transfer pairing is important enough to become a later dedicated issue.

Until pair matching exists, transfer-related activities must remain visible and must not be silently reclassified as buys or sells.

### 7. Deposits and withdrawals

Treat `deposit` and `withdrawal` conservatively.

They can mean external inflow/outflow, transfer-like movement or another Parqet-specific movement. They must not be automatically classified as internal transfers unless later pairing evidence supports that.

The pipeline should preserve them, show them in the timeline and attach warnings/confidence where their impact is ambiguous.

### 8. Fees and taxes

Preserve `fees_taxes` as its own timeline-visible and separately aggregable activity category.

Do not silently merge `fees_taxes` into buy, sell or dividend calculations in Phase 1.

The fields `fee`, `tax`, `amount`, `amountNet` and currency-related data must be preserved for later cost-basis, performance and audit decisions.

### 9. Parqet reference fields

Preserve these fields as Parqet reference fields:

- `realizedGains`
- `realizedGainsNet`
- `buyAmountNet`
- `avgHoldingPeriod`

These values can be useful for audit and comparison. They must not become the app's final self-owned realized-gain or holding-period calculation logic without a later cost-basis ADR or implementation decision.

### 10. Holdings/assets gap

Keep dedicated holdings/assets as a known gap.

The first runtime audit did not use a safe separate holdings/assets source. The activity payload already includes `holdingId`, `holdingAssetType` and `asset.isin`, which is enough for the first architecture direction.

Endpoint expansion for holdings/assets requires a later OpenAPI cross-check and, if needed, a dedicated issue.

### 11. OpenAPI cross-check

Create the ADR from runtime audit findings now. Treat OpenAPI cross-check as a follow-up issue or later ADR update.

Relevant references for that follow-up:

- OpenAPI JSON specification: `https://developer.parqet.com/api-spec/current.json`
- Developer Hub overview: `https://developer.parqet.com/llms.txt`

The OpenAPI cross-check should validate endpoint availability, schemas, pagination, IDs and holdings/assets options before endpoint expansion or advanced assumptions.

## Consequences

Positive consequences:

- The first Global Asset model has a clear primary merge key: `asset.isin`.
- Portfolio-wide consolidation is possible without losing holding/portfolio origin.
- Transfer-related activities are explicitly preserved instead of being misclassified.
- Fees, taxes and Parqet reference values remain available for later audit and comparison.
- Future implementation can proceed through a stable normalization boundary.

Trade-offs and risks:

- Assets without ISIN are not fully solved by this ADR.
- `holdingId` may be useful for some Parqet-specific cases but is intentionally not the global merge key.
- Transfer pair matching remains unresolved and must not be faked in early implementation.
- Portfolio context must be added carefully during fetch; losing it would break portfolio breakdowns and transfer work.
- Holdings/assets endpoint support remains unknown until OpenAPI cross-check or a later audit.

Operational impact:

- Future Phase-1 implementation should create a Global Asset type model before production aggregation.
- Fetch logic for new pipeline work must attach portfolio context to every activity.
- Audit/report output should identify missing portfolio context as a blocker for portfolio-specific metrics.
- Product UI must not switch to the new pipeline before the Phase-1 implementation gate is satisfied.

Documentation impact:

- `docs/PARQET_API_AUDIT.md` remains the runtime evidence source for this ADR.
- Phase status and phase plan should reference this ADR as the decision basis for P1-3 type-model work.
- A later OpenAPI cross-check issue should update or confirm this ADR if official schemas reveal better endpoint options.

## Follow-up work

- P1-3: Define the TypeScript type model for `NormalizedActivity`, `GlobalAsset`, portfolio breakdowns, timeline entries, warnings and confidence.
- Create a later transfer-pairing issue for `transfer_in` / `transfer_out` matching.
- Create a later OpenAPI cross-check issue against the official Parqet Connect OpenAPI spec.
- Decide cost-basis and realized-gain treatment in a later ADR or implementation issue.

## Related Issues / PRs

- Refs #57
- Refs #58
- Fixes #62
