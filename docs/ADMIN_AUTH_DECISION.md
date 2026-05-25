# Admin Auth Decision: Parqet Connect Identity

Status: Spike / Documentation for #358 (Refs #343)
Date: 2026-05-25

## Scope

Goal: decide whether the current Parqet Connect OAuth integration can provide a stable server-side identity for future admin access checks.

Out of scope:
- productive admin auth implementation
- Refine integration
- dependency changes
- DB migrations
- write actions

## Inspected Repo Files

Auth/OAuth and token handling:
- `src/app/api/auth/start/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/lib/parqet.ts`

Portfolio/activity routes and refresh behavior:
- `src/app/api/parqet/portfolios/route.ts`
- `src/app/api/parqet/activities/route.ts`
- `src/app/api/parqet/health/route.ts`
- `src/lib/parqet-assets/fetch-portfolios.ts`
- `src/lib/parqet-assets/build-activity-context.ts`

Repo docs with prior provider evidence:
- `docs/PROVIDER_DATA_SOURCE_STRATEGY.md`
- `docs/PARQET_API_AUDIT.md`

## Inspected Parqet Public Docs/Pages

Checked on 2026-05-25:
- https://developer.parqet.com/blog/implementing-oauth-authentication
- https://developer.parqet.com/docs/build-your-first-parqet-integration
- https://developer.parqet.com/docs
- https://developer.parqet.com/docs/api
- https://developer.parqet.com/api-spec/current.json

## Findings

### Existing repo auth behavior

- OAuth authorize route requests only `scope=portfolio:read`.
- OAuth callback exchanges code at `https://connect.parqet.com/oauth2/token` and stores `access_token`/`refresh_token` in HTTP-only cookies.
- Token helpers support refresh flow and rotate cookies when refresh succeeds.
- Server routes use token/cookie presence to access Parqet portfolio/activity data and to retry on likely auth failures.
- Current flow is data-authorization-centric (portfolio access), not role/permission-centric (admin authorization).

### Identity signals from Parqet docs

- OpenAPI currently documents `GET /user` (operation `user_info`) returning a schema with `userId`, `installationId`, and `state`.
- OpenAPI documented scopes are `portfolio:read` and `portfolio:write`.
- No documented admin/role scopes were found.
- OAuth docs show standard token exchange fields (`access_token`, `refresh_token`, expiry), but do not document ID token / OpenID claims for app authorization.

### Token format

- In the inspected repo code, tokens are treated as opaque bearer tokens and are never decoded.
- In inspected Parqet docs/OpenAPI, no JWT claim contract for authorization decisions was documented.
- Conclusion: token payload must be treated as opaque for this app’s admin authorization design.

## Decision

Decision: **Conditionally suitable**.

Interpretation:
- Parqet Connect appears suitable for obtaining a stable external identity key (`userId` from `/user`) for linkage/audit context.
- Parqet Connect alone is **not suitable** as the sole source of admin authorization.

Reason:
- Available scopes are portfolio data scopes, not admin entitlement scopes.
- OAuth success proves delegated portfolio access, not that the user is an app admin.
- Coupling admin permission directly to provider OAuth grants would be a privilege model mismatch.

## Why Parqet OAuth Alone Must Not Equal Admin Permission

- Consent to portfolio data access is not equivalent to internal admin entitlement.
- Provider account ownership and app admin ownership are separate trust domains.
- Scope `portfolio:read`/`portfolio:write` governs provider data access, not app-level control-plane actions.
- Revocation/rotation behavior of provider tokens should not directly define admin policy state.

## Recommended Phase 1 Admin Guard (#343)

Use a strict server-side dev/env guard first:
- Keep admin UI/API non-productive and read-only.
- Gate admin endpoints by environment and explicit allowlist configuration.
- Return a minimal `/api/admin/session` response for UI gating only (no write permissions).
- Do not infer admin rights from Parqet token presence.

Phase-1 read-only posture:
- `accessControlProvider` default deny for mutations.
- Explicitly allow only safe read/list actions required for shell validation.

## Recommended Phase 2 Admin Auth Direction

Preferred direction unless Parqet identity contract is further strengthened and accepted:
- Introduce dedicated app auth provider for admin identity and policy (Auth.js with GitHub/Google, or Vercel protection layer depending on deployment context).
- Keep Parqet Connect as provider-data authorization channel.
- Optionally map Parqet `userId` as secondary linkage/audit attribute, not as primary admin entitlement key.

## Proposed `/api/admin/session` Behavior (Later)

Contract intent (server-owned decision):
- Resolve caller identity via admin auth mechanism (not Parqet OAuth alone).
- Optionally attach Parqet linkage status (connected/not-connected and optional stable `parqetUserId` if explicitly fetched server-side).
- Return:
  - `authenticated: boolean`
  - `admin: boolean`
  - `roles: string[]`
  - `permissions: string[]`
  - `parqet: { connected: boolean; userId?: string }` (optional, non-authoritative)
- For unauthenticated/unauthorized callers: 401/403 with no sensitive details.

Refine integration expectation:
- `authProvider.check` should call `/api/admin/session`.
- `accessControlProvider` should use server-returned permissions and stay read-only initially.

## Privacy/Security Risks

- Risk if admin rights are derived from bearer-token possession or provider connection status.
- Risk of cross-domain authorization confusion (provider consent vs app entitlement).
- Risk of leaking tokens/cookies/user identifiers in logs or diagnostics.
- Risk of stale or revoked provider identity assumptions without server-side session policy.

Mitigation baseline:
- Keep tokens opaque and HTTP-only.
- Enforce server-owned admin policy independent of Parqet OAuth grant.
- Restrict diagnostic output; do not log secrets/private payloads.

## Next Issue Proposal (Refine Admin Shell)

Proposed issue title:
- "Phase 1 Refine Admin Shell: env-guarded read-only session gate"

Proposed scope:
- Add non-productive `/api/admin/session` endpoint with env/allowlist guard.
- Wire Refine `authProvider` to session check.
- Wire `accessControlProvider` to read-only defaults.
- Add explicit non-goals: no productive auth rollout, no write actions, no DB persistence, no Parqet calls in normal user paths.

Acceptance focus:
- Admin shell visible only when server guard allows.
- Unauthorized users receive deny state.
- No coupling of admin permission to Parqet OAuth token presence.

## Decision Result Summary

- Stable Parqet identity signal likely exists via documented `/user.userId`.
- This is useful for identity linkage, not sufficient for admin authorization.
- Recommendation stands: Parqet Connect remains portfolio-data authorization; admin permission must be owned by separate app auth/policy.
