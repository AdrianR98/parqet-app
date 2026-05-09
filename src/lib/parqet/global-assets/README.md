# Global Assets

This folder contains the Phase-1 type boundary for the Global Asset Timeline foundation.

The model is based on:

- `docs/PARQET_API_AUDIT.md`
- `docs/adr/0002-global-asset-timeline.md`
- #57 Phase-1 parent issue
- #64 type-model issue

## Allowed contents in P1-3

- TypeScript types.
- Small type guards / pure predicates.
- Comments that document invariants and boundaries.

## Non-goals in P1-3

- No normalization implementation.
- No aggregation implementation.
- No transfer pairing.
- No cost-basis calculation.
- No warning/confidence derivation.
- No product UI.
- No product API route changes.
- No raw Parqet payload exposure.

## Key boundary

Raw Parqet activities must be enriched with portfolio context before normalization. The runtime audit did not show an obvious direct portfolio reference in activity payloads.

The next implementation step is P1-4: Normalization Pipeline.
