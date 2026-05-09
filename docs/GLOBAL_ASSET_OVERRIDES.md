# Global Asset Overrides

Status: Phase 1 foundation

## Purpose

Global Asset overrides are the future mechanism for user-confirmed decisions when Parqet activities cannot be interpreted safely by the app.

The first target is unresolved negative quantity cases.

The app must not silently delete, ignore, reclassify or fabricate activities. Corrections should only be applied when they are deterministic and safe, or when the user has explicitly confirmed the treatment.

## Current scope

This document describes the model foundation only.

Implemented in this phase:

- unresolved negative quantity cause classification,
- warning metadata for negative quantity causes,
- unresolved decision candidates in the audit report,
- empty override JSON file,
- override type/parser/loader foundation.

Not implemented yet:

- UI for user decisions,
- write API for saving decisions,
- database persistence,
- applying corrections to calculations,
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
```

### `ignore_activity_for_position`

Use when an activity should stay visible in the timeline but should not affect quantity.

Example: a duplicated sell is present and the user confirms that one sell should not affect position calculation.

### `reclassify_activity_type`

Use when the app should treat an activity differently than the raw source type.

Example: a raw sell should later be treated as a correction or no-position-effect event.

### `add_manual_quantity_adjustment`

Use when an inbound/outbound quantity is missing and the user chooses to add a local correction.

Example: add +0.2025 for one ISIN/portfolio on a chosen date.

### `mark_as_known_external_issue`

Use when the user acknowledges a problem but does not want to correct it yet.

Metrics should remain blocked unless a later explicit decision says otherwise.

## Cause categories

Initial negative quantity cause categories:

```text
sell_exceeds_known_position
transfer_in_then_sell_then_sell
duplicate_sell_candidate
missing_inbound_activity
unknown_negative_quantity_case
```

These categories are diagnostic. They do not repair data by themselves.

## Safety rules

- Raw Parqet payloads must not be committed.
- Real portfolio IDs and activity IDs must not be exposed in docs or issues.
- Audit output must keep redaction defaults.
- User decisions must be undoable/resettable in a later UI.
- Affected position and portfolio-breakdown metrics remain blocked until a confirmed treatment exists.

## Next steps

Later issues should add:

1. applying a narrow override class, such as `ignore_activity_for_position`,
2. a local/dev-only write path or future persistence model,
3. a UI for reviewing and resetting decisions,
4. transfer pairing after unresolved sell/missing-inbound cases are diagnosable.
