# Agent Entrypoint

This file is the compact dispatcher for Codex and future agents working in `AdrianR98/parqet-app`. Keep detailed explanations in `prompts/README.md`, operational rules in `prompts/*.yaml`, and human-readable workflow details in `docs/*.md`.

Read order:

1. Read this file first.
2. Read the `Mode` from the task prompt.
3. If `Mode` is missing, stop and report that the task is incomplete.
4. Do not choose, infer, upgrade or downgrade the mode.
5. Read only the mode-specific files required by `prompts/codex-execution-rules.yaml` and the task scope.
6. Do not read all workflow or docs files by default.

Core rules:

- English is the repository source-of-truth language.
- Keep changes small, reviewable, branch-based and issue-linked.
- ChatGPT sets the Codex task mode before execution; Codex only follows the supplied mode.
- Use `Voll` only when the ChatGPT-authored task explicitly sets it, especially for risky first tasks touching auth, provider contracts, data pipeline, persistence, caching, security, Branch Protection or large refactorings.
- Do not redesign the app or implement product features unless the issue explicitly requests it.
- Phase-1 analysis tasks are read/report-first and must not change app code unless explicitly allowed.
- Do not create a second activity or asset pipeline before Phase 1 decides otherwise or an ADR allows it.
- Treat external API budget minimization as a product and architecture rule, not just a debugging preference.
- Any provider/API-touching change must describe request impact, cache/reuse strategy, retry behavior and rate-limit handling.
- Avoid automatic full reloads for navigation, filtering, editing or rendering unless an issue explicitly justifies them.
- Prefer explicit refresh actions, cached snapshots, narrow request scopes, provider-side filters, pagination and bounded concurrency.
- Codex must not commit unless the task explicitly allows it.
- Codex must never create PRs, run `gh pr create`, merge or choose branch names.
- ChatGPT/Reviewer may merge only after explicit instruction and after reviewing the diff against issue acceptance criteria, guardrails, API-budget impact, privacy/data impact and non-goals.
- New work must be phase-classified before implementation.
- Agents do not get unrestricted authority. Detailed agent permissions live in `prompts/workflow-chatgpt-codex.yaml` and `docs/DEVELOPMENT_WORKFLOW.md`.
- Sensitive or non-public data must stay out of diffs, logs, issues and PR text.
- If such data appears in a diff, the PR is blocked.
