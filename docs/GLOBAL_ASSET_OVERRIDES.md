# Global Asset Overrides

Status: Phase 1 narrow application

## Purpose

Global Asset overrides are the mechanism for user-confirmed decisions when Parqet activities cannot be interpreted safely by the app.

The first target is unresolved negative quantity cases.

The app must not silently delete, ignore, reclassify or fabricate activities. Corrections should only be applied when they are deterministic and safe, or when the user has explicitly confirmed the treatment.

## Current scope

Implemented in this phase:

- unresolved negative quantity cause classification,
- warning metadata for negative quantity causes,
- unresolved decision candidates in the audit report,
- empty override JSON file,
- override type/parser/loader foundation,
- narrow application of `ignore_activity_for_position`,
- refined candidate metadata for non-duplicate negative positions.

Not implemented yet:

- UI for user decisions,
- write API for saving decisions,
- database persistence,
- broad activity reclassification,
- synthetic manual quantity adjustments,
- automatic repair.

## Override file

The local foundation file is:

```text
src/data/global-asset-overrides.json
```

Initial content:

```json
[]
```

Do not commit real personal decisions unless they are synthetic examples.

## Decision types

Supported decision type names:

```text
ignore_activity_for_position
reclassify_activity_type
add_manual_quantity_adjustment
mark_as_known_external_issue
manual_review_required
```

### `ignore_activity_for_position`

Use when an activity should stay visible in the timeline but should not affect quantity.

Example: a duplicated sell is present and the user confirms that one sell should not affect position calculation.

This is the first decision type that is applied by the aggregation layer.

When a matching enabled override exists:

- the activity remains visible in the Global Asset timeline,
- the activity keeps its original type and raw normalized fields,
- `positionOverride.affectsPosition` is set to `false`,
- the activity contributes `0` to position quantity calculations,
- audit output includes redacted applied override metadata.

### `reclassify_activity_type`

Use when the app should treat an activity differently than the raw source type.

Example: a raw sell should later be treated as a correction or no-position-effect event.

This decision type is parsed but not applied yet.

### `add_manual_quantity_adjustment`

Use when an inbound/outbound quantity is missing and the user chooses to add a local correction.

Example: add a confirmed local quantity adjustment for one asset/portfolio on a chosen date.

This decision type is parsed but not applied yet.

### `mark_as_known_external_issue`

Use when the user acknowledges a problem but does not want to correct it yet.

Metrics should remain blocked unless a later explicit decision says otherwise.

This decision type is parsed but not applied yet.

### `manual_review_required`

Use when the candidate should remain blocked until a user explicitly reviews it.

This is useful for ratio/factor mismatch cases where ignoring an activity would be too aggressive.

This decision type is parsed but not applied yet.

## Matching rules for `ignore_activity_for_position`

Matching is intentionally narrow.

An override is only applied when:

- `enabled === true`,
- `decisionType === "ignore_activity_for_position"`,
- `assetKey` matches the activity asset key,
- at least one specific match field exists beyond `assetKey`,
- optional `match.portfolioId`, if present, matches the activity portfolio id,
- optional `match.activityId`, if present, matches the source or internal activity id,
- optional `match.datetime`, if present, matches activity datetime,
- optional `match.sourceType`, if present, matches activity source type,
- optional `match.quantity`, if present, matches activity quantity within the existing quantity tolerance.

If only the asset key is provided, the override is ignored. This prevents accidental asset-wide position suppression.

## Local-only example shape

Do not commit real values. This example is illustrative only.

```json
[
  {
    "id": "local-ignore-duplicate-sell-example",
    "enabled": true,
    "createdAt": "2026-05-09T00:00:00.000Z",
    "assetKey": {
      "type": "isin",
      "value": "US0000000000"
    },
    "decisionType": "ignore_activity_for_position",
    "reason": "Synthetic example: user confirmed duplicate sell should not affect position.",
    "match": {
      "activityId": "local-or-source-activity-id",
      "portfolioId": "real-local-portfolio-id",
      "quantity": 0.828
    },
    "effect": {
      "affectsPosition": false
    }
  }
]
```

## Audit behavior

Applied overrides are exposed in the local audit report through:

```text
summary.appliedOverrideCount
aggregation.summary.appliedOverrideCount
aggregation.appliedOverrides
```

Defaults remain privacy-safe:

- portfolio IDs are pseudonymized,
- activity IDs are hidden unless `includeActivityIds=true`,
- raw Parqet payloads are never returned,
- amounts remain hidden unless `includeAmounts=true`.

Activity-level audit data can also show `positionOverride` on redacted timeline entries when assets/activities are included.

## Cause categories

Negative quantity cause categories:

```text
sell_exceeds_known_position
sell_quantity_ratio_mismatch
possible_decimal_or_split_issue
transfer_in_then_sell_then_sell
duplicate_sell_candidate
missing_inbound_activity
unknown_negative_quantity_case
```

These categories are diagnostic. They do not repair data by themselves.

Duplicate-like cases can suggest `ignore_activity_for_position` because one activity may be a duplicate. Non-duplicate ratio cases are more conservative and should prioritize `manual_review_required`, `mark_as_known_external_issue`, a future manual quantity adjustment or reclassification.

## Ratio metadata

For non-duplicate negative positions, candidate metadata can include:

```text
quantityRatio
possibleMismatchFactor
ratioHint
```

This helps identify patterns such as an outbound quantity that is roughly 10x, 100x or 1000x the known inbound quantity.

This metadata is diagnostic only. It does not change calculations.

## Safety rules

- Raw Parqet payloads must not be committed.
- Real portfolio IDs and activity IDs must not be exposed in docs or issues.
- Audit output must keep redaction defaults.
- User decisions must be undoable/resettable in a later UI.
- Empty override files must not change behavior.
- Disabled overrides must not change behavior.
- Unsupported decision types must not change behavior.
- Affected position and portfolio-breakdown metrics remain blocked until a confirmed treatment exists.

## Next steps

Later issues should add:

1. a local/dev-only write path or future persistence model,
2. a UI for reviewing and resetting decisions,
3. broader reclassification and manual quantity adjustment handling,
4. transfer pairing after unresolved sell/missing-inbound cases are diagnosable.
