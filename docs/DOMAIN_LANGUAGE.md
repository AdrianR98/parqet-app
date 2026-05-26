# Domain Language

This file defines the initial shared vocabulary for Parqet App discussions, planning, and implementation prompts.

## Terms

### Global Asset

A normalized cross-portfolio asset identity used to represent one economic instrument consistently across provider responses and local projections.

### Product Read Model

The query-focused representation used by app views and APIs to serve portfolio/product information efficiently without redefining upstream source contracts.

### Compatibility Path

A temporary, explicitly scoped transition path used to keep behavior stable while replacing an old implementation. It must have an exit plan and removal criteria.

### Security Lineage

The traceable origin and transformation chain for security-related identifiers and attributes (for example symbols, ISIN-like identifiers, mappings, and derived labels).

### Asset Family

A grouping concept for related instruments that share classification characteristics (for example equity, ETF, fund, bond, cash equivalent, or derivative groupings).

### Corporate Action Event

A time-bound issuer or market event that changes holdings, price basis, or metadata (for example split, merger, spin-off, dividend, ticker change, delisting).

### Lineage Projection

A read-focused projection of how source events and mappings were transformed into currently displayed state, with emphasis on reproducibility and auditability.

### Blocked Metrics

Metrics intentionally withheld from presentation or downstream use because required prerequisites are missing, inconsistent, unverifiable, or outside allowed confidence thresholds.

### Confidence Signals

Structured indicators that communicate reliability of derived values or mappings (for example source completeness, reconciliation status, freshness, and conflict state).

## Usage Rules

1. Use these terms consistently in issues, prompts, and docs.
2. Prefer explicit term usage over ambiguous shorthand.
3. If a new term is needed, define it here before broad usage.
4. Keep definitions English and implementation-neutral.
