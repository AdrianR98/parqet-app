# Agent Entrypoint

This file is the short entrypoint for Codex and future agents working in `AdrianR98/parqet-app`.

Read first:

- `prompts/master-prompt.yaml`
- `prompts/codex-quick-rules.yaml`
- `prompts/workflow-chatgpt-codex.yaml`
- `prompts/codex-task-template.yaml`
- `prompts/codex-execution-rules.yaml`
- `docs/DEVELOPMENT_WORKFLOW.md`
- `docs/PHASE_PLAN.md`
- `docs/V1_GUARDRAILS.md`
- `docs/LOCAL_QUICKSTART.md`
- `docs/PROJECT_STATUS.md`

Core rules:

- English is the repository source-of-truth language.
- Keep changes small, reviewable, branch-based and issue-linked.
- Default Codex mode is `Spar`.
- Use `Voll` for risky first tasks touching auth, tokens, Parqet API contracts, data pipeline, persistence, caching, security, Branch Protection or large refactorings.
- Do not redesign the app or implement product features unless the issue explicitly requests it.
- Phase-1 analysis tasks are read/report-first and must not change app code unless explicitly allowed.
- Do not create a second activity or asset pipeline before Phase 1 decides otherwise or an ADR allows it.
- Treat external API budget minimization as a product and architecture rule, not just a debugging preference.
- Any Parqet/API-touching change must describe request impact, cache/reuse strategy, retry behavior and rate-limit handling.
- Avoid automatic full reloads for navigation, filtering, editing or rendering unless an issue explicitly justifies them.
- Prefer explicit refresh actions, cached snapshots, narrow request scopes, provider-side filters, pagination and bounded concurrency.
- Codex must not commit, open PRs or choose branch names unless the task explicitly allows it.
- Codex must never merge.
- ChatGPT/Reviewer may merge only after explicit instruction and after reviewing the diff against issue acceptance criteria, guardrails, API-budget impact, privacy/data impact and non-goals.
- New work must be phase-classified before implementation.
- Agents do not get unrestricted authority. Detailed agent permissions live in `prompts/workflow-chatgpt-codex.yaml` and `docs/DEVELOPMENT_WORKFLOW.md`.
- Never commit real tokens, `.env` files, cookies, OAuth codes, private Parqet exports, real portfolio/depot data, private screenshots or debug logs with private API responses.
- Private local reference files may exist only in ignored paths such as `.local/`.
- If private data appears in a diff, the PR is blocked.
