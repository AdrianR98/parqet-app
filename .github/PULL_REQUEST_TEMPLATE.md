## Linked Issue(s)

- Refs #
- Fixes #

## Phase

- [ ] Phase 0 - Project rules / architecture / guardrails
- [ ] Phase 1 - App shell / navigation / UI foundation
- [ ] Phase 2 - Data foundation / API budget
- [ ] Phase 3 - Core product surfaces
- [ ] Phase 4 - V1 hardening / release-candidate preparation
- [ ] Phase 5 - V1 QA / release cut
- [ ] Phase 6 - Post-V1 feature expansion
- [ ] Not phase-bound / maintenance

## Summary

- TBD

## Scope

- Allowed changes:
- Changed files:
- Codex involvement / mode:

## Non-goals

- TBD

## UI / UX Impact

- [ ] No UI change
- [ ] Navigation changed
- [ ] Screen/section changed
- [ ] Form/control changed
- [ ] Empty/loading/error/stale state changed
- [ ] Visual/responsive behavior changed
- [ ] Accessibility impact reviewed

## Visual Checklist

- [ ] Desktop layout reviewed
- [ ] Mobile/responsive layout reviewed
- [ ] Text overflow checked
- [ ] Empty/loading/error/stale states reviewed
- [ ] Screenshots or visual notes included when useful and privacy-safe
- [ ] Not applicable, with reason:

## API Budget Impact

Required. Do not leave blank. `none` is allowed only when consciously entered.

- Provider/API requests triggered:
- Cache/snapshot reuse:
- Retry/rate-limit behavior:
- Hidden reload risk:

## Privacy / Data Impact

Required. Do not leave blank. `none` is allowed only when consciously entered.

- Private data touched:
- Logs/diagnostics/exports:
- Screenshots/examples:
- Redaction notes:

## Architecture / Data Model Impact

- [ ] No architecture or data-model impact
- [ ] ADR added/updated
- [ ] Existing ADR still applies
- [ ] Provider DTO / internal model / UI read-model boundary reviewed
- Notes:

## Documentation Impact

- [ ] README/docs updated
- [ ] Phase plan updated
- [ ] V1 guardrails updated
- [ ] ADR added/updated
- [ ] Changelog updated
- [ ] German translation impact checked where a matching `.de.md` file exists
- [ ] No documentation change needed, with reason:

## Testing

Use `Run`, `Not run` or `Not applicable`.

- `git diff --check`:
- YAML/Markdown validation:
- `npm run lint`:
- `npx tsc --noEmit`:
- `npm run build`:
- Manual verification:

## Reviewer Checklist

- [ ] Diff reviewed against linked issue acceptance criteria
- [ ] Scope matches the issue and PR body
- [ ] Non-goals were respected
- [ ] API Budget Impact is present and reviewed
- [ ] Privacy / Data Impact is present and reviewed
- [ ] For API/data-facing changes, hidden provider calls, broad reloads, unbounded retries and raw private data exposure were checked
- [ ] UI/visual impact reviewed when applicable
- [ ] Architecture/data-model impact reviewed when applicable
- [ ] Docs/changelog/ADR impact reviewed
- [ ] No private exports, real portfolio/depot data, screenshots with private data, tokens, cookies, OAuth codes or `.env` files
- [ ] Issues are closed only after implementation is verified against acceptance criteria

## Post-merge Cleanup

- [ ] Roadmap/phase plan checked
- [ ] Docs checked
- [ ] Related issues checked
- [ ] Changelog checked
- [ ] Follow-up issues created or linked for deferred work
- [ ] Not applicable, with reason:
