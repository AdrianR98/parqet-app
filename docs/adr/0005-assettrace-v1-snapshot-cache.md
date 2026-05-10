# ADR 0005: AssetTrace v1 Snapshot Cache and Production Storage Boundary

Status: accepted
Date: 2026-05-10
Owner: AdrianR98

## Context

AssetTrace v1 needs to reduce unnecessary Parqet/provider calls across normal navigation, filtering, sorting, reports, asset detail and activities views. The app already treats API budget as a product constraint and uses explicit dashboard load/refresh actions as the intended expensive data path.

Issue #163 asks for a production cache decision, but it does not authorize durable server-side storage for private portfolio or activity data.

## Decision

AssetTrace v1 uses a bounded, process-local, in-memory activity snapshot foundation for server-side route reuse and the existing bounded browser-local dashboard read model for UI reuse.

The v1 snapshot stores only derived route inputs needed by the current app surfaces:

- selected portfolio scope metadata,
- safe freshness/status metadata,
- filtered security activities needed by explicit v1 route reuse,
- normalized/corrected activity data for bounded snapshot-backed projections,
- reconciliation warnings,
- generated asset and activity read models in the browser cache.

The v1 snapshot must not store OAuth tokens, cookies, authorization headers or raw provider responses, and those values must not be exposed in UI, diagnostics or exports. It must be refreshed only by explicit load/refresh actions. Normal navigation, local filtering, local sorting, reports, asset detail and opening the Activities page must use existing snapshot/cache data or show an empty/no-snapshot state.

## Production storage boundary

No durable production database or server persistence is introduced in v1. The server snapshot is process-local, in-memory and non-durable; the browser cache is a local read model for UI continuity, not production persistence.

Durable storage remains a later decision and requires a separate ADR before implementation. Options to evaluate later include:

1. encrypted server-side database rows scoped by user and provider authorization,
2. short-retention object/blob snapshots with explicit deletion,
3. browser-only storage with quota-aware pruning,
4. no durable storage, relying only on explicit refresh and in-memory reuse.

## Risks for a later durable cache

A future durable cache decision must address:

- privacy classification of portfolio, holding and activity data,
- storage location and encryption model,
- user-triggered deletion and retention windows,
- OAuth scope changes and revoked provider access,
- rate-limit behavior during cache warming or refresh,
- stale-data visibility and user trust,
- migrations when normalized activity models change.

## Consequences

Positive:

- v1 reduces repeated provider calls during repeated route usage and client navigation.
- Freshness metadata can be surfaced safely without exposing tokens or raw payloads.
- Activities can render local snapshot-backed data without a hidden provider fetch.

Trade-offs:

- In-memory snapshots are process-local, non-durable and may disappear across deploys, cold starts or server restarts.
- The browser-local read model is useful for UI continuity but is not a production persistence strategy.
- Large activity scopes may be skipped by snapshot bounds and still require explicit refresh.

## Related issues

- Refs #158
- Refs #159
- Refs #160
- Refs #161
- Refs #162
- Refs #163
- Refs #181
