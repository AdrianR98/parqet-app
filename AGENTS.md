# Agent Entrypoint

This file is the compact dispatcher for Codex and future agents working in `AdrianR98/parqet-app`. Keep detailed explanations in `prompts/README.md`, operational rules in `prompts/*.yaml`, and human-readable workflow details in `docs/*.md`.

Read order:

1. Read this file first.
2. Read the `Mode`, `Branch`, and `Create PR` fields from the task prompt.
3. If `Mode` or `Branch` is missing for a non-trivial task, stop and report that the task is incomplete.
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
- If a feature, provider path, UI flow or implementation is replaced and explicitly removed, delete it from code and docs. Do not preserve it as deprecated, legacy, fallback or historical implementation unless a task explicitly requires a transitional compatibility path.
- Treat external API budget minimization as a product and architecture rule, not just a debugging preference.
- Any provider/API-touching change must describe request impact, cache/reuse strategy, retry behavior and rate-limit handling.
- Avoid automatic full reloads for navigation, filtering, editing or rendering unless an issue explicitly justifies them.
- Prefer explicit refresh actions, cached snapshots, narrow request scopes, provider-side filters, pagination and bounded concurrency.
- Codex must not commit unless the task explicitly allows it.
- Codex must not push unless the task explicitly allows it.
- Codex must never create PRs, run `gh pr create`, close issues, merge, change labels/milestones or choose branch names unless explicitly authorized.
- ChatGPT/Reviewer may merge only after explicit instruction and after reviewing the diff against issue acceptance criteria, guardrails, API-budget impact, privacy/data impact and non-goals.
- New work must be phase-classified before implementation.
- Agents do not get unrestricted authority. Detailed agent permissions live in `prompts/workflow-chatgpt-codex.yaml` and `docs/DEVELOPMENT_WORKFLOW.md`.
- Sensitive or non-public data must stay out of diffs, logs, issues and PR text.
- If such data appears in a diff, the PR is blocked.

Low-budget Codex defaults:

- Default verification profile is `not_run_by_default`.
- Do not run tests, lint, typecheck, build, Playwright, Vitest, Jest, smoke probes, browser probes, API probes, Vercel deploys or other verification commands unless the task explicitly names the check.
- GitHub Actions, user review and ChatGPT diff review are the default final gates.
- Read only the minimum required files. Prefer targeted sections/ranges over full-file reads.
- Do not run broad repository searches unless exact files are unknown or blocked.
- Stop if the required scope exceeds the selected mode file limit unless the task explicitly allows broader scope.

Codex output discipline:

- Default output mode is final-only.
- During execution, output only a concise blocker message if blocked.
- Do not print command logs, command transcripts, command lists, routine progress narration, implementation phases, file-read narration, search narration, full diffs, full files, full logs or generated output.
- If verification is run, summarize only status, not commands or logs.
- Verification lines must use:
  - `Verification: <check name> — passed`
  - `Verification: <check name> — failed: <short reason>`
  - `Verification: not run — <reason>`
- Do not list every command unless the task explicitly requests exact commands.
- For failures, include only the relevant failure excerpt.
- No `Run: npm ...` blocks in normal final handoff unless explicitly requested.
- Final handoff must stay compact and use:
  - Branch
  - Changed files
  - Removed files, if any
  - What changed
  - Verification
  - Known blockers / manual checks
  - Commit SHA
  - PR URL, if already open
