# Global Asset Overrides

Status: DP-09 locked documentation decision for #166 (Refs #248)

## Purpose

DP-09 defines the durable override/user-decision model for unresolved Global Asset data-quality cases.

This decision is documentation-only. It does not authorize runtime implementation, UI/write flows, route migration, provider/API behavior, OAuth/token changes or durable storage.

## Decision summary

- User decisions are explicit records, not implicit repairs.
- Unsupported or disabled decisions are no-op by policy.
- `ignore_activity_for_position` remains the only currently applied decision type and stays narrow.
- Decision effects are split into display-only, warning/confidence-affecting and calculation-affecting classes.
- Any effect on calculations, warnings, confidence or `blockedMetrics` requires validation gates before application.
- Future review/edit flows must stay local/snapshot/browser-only unless a later issue explicitly authorizes provider/API behavior.

## Current implementation boundary

Implemented now:

- unresolved decision candidates and cause metadata in Global Asset audit/aggregation docs,
- empty local decision file foundation,
- decision parser/loader foundation,
- narrow `ignore_activity_for_position` application.

Not implemented:

- write/edit UI,
- new write API,
- durable storage,
- broad reclassification,
- manual synthetic quantity adjustment application,
- automatic repair.

## Local decision file

Current local file:

```text
src/data/global-asset-overrides.json
```

Expected baseline content:

```json
[]
```

Real personal decisions must not be committed. Only synthetic examples are allowed in repository documentation.

## Decision categories and scope

Supported DP-09 decision type names:

```text
ignore_activity_for_position
reclassify_activity_type
add_manual_quantity_adjustment
mark_as_known_external_issue
manual_review_required
```

Category mapping and current policy:

| Decision type | Category | Impact class | Current policy status | Scope notes |
| --- | --- | --- | --- | --- |
| `ignore_activity_for_position` | Position effect override | Calculation-affecting | Implemented (narrow) | A matched activity remains visible but contributes `0` to position quantity only. |
| `reclassify_activity_type` | Activity classification decision | Calculation-affecting (future) | Parsed/not applied | Must remain no-op until a later issue defines safe target-type policy and validation. |
| `add_manual_quantity_adjustment` | Synthetic quantity correction | Calculation-affecting (future) | Parsed/not applied | Must remain no-op until a later issue defines synthetic entry model, validation and rollback semantics. |
| `mark_as_known_external_issue` | Acknowledge unresolved issue | Warning/confidence-affecting (future) | Parsed/not applied | Should keep metrics blocked by default unless a later explicit policy allows scoped unblocking. |
| `manual_review_required` | Explicit review hold | Display-only or warning/confidence-affecting (future) | Parsed/not applied | Must preserve blocked state until confirmed treatment exists. |

## Impact classes

### Display-only decisions

Display-only decisions can annotate audit/review state and may change labels or review queues. They must not change calculations, warnings, confidence or `blockedMetrics`.

### Warning/confidence-affecting decisions

These decisions may later affect warning visibility/classification or confidence level, but must not silently unblock blocked metrics without explicit, validated policy.

### Calculation-affecting decisions

These decisions can alter quantity/cost/performance inputs. They require the strictest validation and explicit audit traces before any metric is treated as complete.

## Minimum safe decision-record fields

Every decision record that may be reviewed or applied must include:

- stable `id`,
- `enabled` flag,
- `decisionType`,
- `createdAt` timestamp,
- optional `updatedAt` timestamp when changed,
- `assetKey` with type/value,
- human-readable `reason`,
- deterministic `match` scope for activity-level decisions,
- explicit `effect` object where applicable.

Recommended review metadata for future flows:

- actor alias (no private identity leak),
- review state (draft/confirmed/revoked),
- changedBy/changedAt for auditability.

Records missing mandatory fields must be treated as invalid and no-op.

## Validation gates before any effect

Before a decision may affect calculations, warnings, confidence or `blockedMetrics`, all gates must pass:

1. Schema validity: known `decisionType`, required fields present, parse-safe values.
2. Activation check: `enabled === true`.
3. Scope check: match criteria are specific enough for the decision class.
4. Policy check: decision type is explicitly enabled for the intended effect class.
5. Safety check: effect does not violate blocked-metric, privacy or guardrail policy.
6. Audit check: applied/rejected state is reviewable in redacted audit output.

If any gate fails, the decision is no-op and must not change output semantics.

## Narrow matching rules for `ignore_activity_for_position`

`ignore_activity_for_position` remains intentionally narrow.

Apply only when:

- `enabled === true`,
- `decisionType === "ignore_activity_for_position"`,
- `assetKey` matches the activity asset key,
- at least one specific `match` field exists beyond `assetKey`,
- optional `match.portfolioId` matches portfolio id when present,
- optional `match.activityId` matches source/internal activity id when present,
- optional `match.datetime` matches activity datetime when present,
- optional `match.sourceType` matches source type when present,
- optional `match.quantity` matches within existing quantity tolerance when present.

If only `assetKey` is present, ignore the decision to prevent asset-wide accidental suppression.

## Current behavior for `ignore_activity_for_position`

When a valid narrow match exists:

- the activity remains visible in the timeline,
- the activity keeps original normalized fields,
- `positionOverride.affectsPosition = false`,
- activity position quantity effect becomes `0`,
- applied override metadata appears in redacted audit output.

This behavior must not be broadened by policy in DP-09.

## Unsupported/disabled decisions are no-op

The following must not change behavior:

- empty decision files,
- disabled decisions,
- unsupported decision types,
- invalid decision records,
- parsed-but-not-applied decision types listed above.

## Undo, delete and reset requirements

Future review/edit flows must satisfy:

- Undo: users can revert the latest confirmed decision effect.
- Delete: users can remove a local decision record safely.
- Reset: users can clear decisions and return to baseline unresolved behavior.
- Reversibility: undo/delete/reset must remove downstream effect deterministically.
- Auditability: decision lifecycle changes are visible as redacted metadata (not raw payload rows).

DP-09 defines these requirements but does not implement UI/write behavior.

## Audit/review requirements (redacted)

Decision review output must be privacy-safe and include at least:

- decision id/type/status,
- effect class and affected scope,
- created/updated timestamps,
- reason summary,
- applied/rejected/no-op result,
- blocked-metric impact summary where relevant.

The existing audit references for applied overrides remain:

```text
summary.appliedOverrideCount
aggregation.summary.appliedOverrideCount
aggregation.appliedOverrides
```

## Privacy and redaction boundaries

Never include raw private payloads in docs, issues, PRs, logs, diagnostics, local committed files or exports.

Required boundaries:

- docs/issues/PRs: synthetic-only examples; no real portfolio/depot/activity rows.
- logs/diagnostics: redacted/count-only where possible; no tokens/cookies/OAuth values.
- local decision files in repo: no real personal decisions committed.
- audit output defaults: pseudonymized portfolio ids, hidden activity ids unless explicitly requested, hidden amounts unless explicitly requested, never raw payload passthrough.
- future exports: only safe, already-visible redacted/read-model fields.

## API-budget behavior for future implementation

DP-09 locks future override/user-decision flows to local/snapshot/browser-only behavior by default:

- decision review, sorting, filtering and rendering must not trigger provider/API calls,
- decision validation/application must not trigger hidden provider/API calls,
- any provider/API behavior requires a later explicit issue decision and review.

## Cause categories and diagnostic metadata

Current negative quantity cause categories remain diagnostic-only:

```text
sell_exceeds_known_position
sell_quantity_ratio_mismatch
possible_decimal_or_split_issue
transfer_in_then_sell_then_sell
duplicate_sell_candidate
missing_inbound_activity
unknown_negative_quantity_case
```

Optional ratio hints such as `quantityRatio`, `possibleMismatchFactor` and `ratioHint` remain diagnostic-only and do not change calculations by themselves.

## Synthetic example shape

Illustrative synthetic-only record:

```json
[
  {
    "id": "synthetic-ignore-duplicate-sell-example",
    "enabled": true,
    "createdAt": "2026-05-13T00:00:00.000Z",
    "assetKey": {
      "type": "isin",
      "value": "US0000000000"
    },
    "decisionType": "ignore_activity_for_position",
    "reason": "Synthetic example: confirmed duplicate sell should not affect position quantity.",
    "match": {
      "activityId": "synthetic-activity-id",
      "portfolioId": "synthetic-portfolio-id",
      "quantity": 0.828
    },
    "effect": {
      "affectsPosition": false
    }
  }
]
```

## Follow-up implementation slices (not implemented here)

1. Pure decision-model helpers with synthetic tests only (no routes/UI/provider calls).
2. Validation helper layer for decision gating and explicit no-op results.
3. Redacted review projection for decision lifecycle and blocked-metric impact.
4. Local-only undo/delete/reset workflow definition and test evidence.
5. Separate issue for any write/edit UI after review of API-budget and privacy impacts.
6. Separate issue for any storage strategy beyond local tracked file semantics.
