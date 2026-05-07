# Agent Entrypoint

This file is the short entrypoint for Codex and future agents working in `AdrianR98/parqet-app`.

Read first:

- `prompts/master-prompt.yaml`
- `prompts/codex-quick-rules.yaml`
- `prompts/workflow-chatgpt-codex.yaml`
- `prompts/codex-task-template.yaml`
- `prompts/codex-execution-rules.yaml`

Core rules:

- English is the source-of-truth language.
- Keep changes small, reviewable and issue-linked.
- Default Codex mode is `Spar`; use `Voll` for risky first tasks touching auth, tokens, API contracts, data pipeline, persistence, caching, CI, security or large refactorings.
- Do not redesign the app or implement product features unless the issue explicitly requests it.
- Do not create a second activity or asset pipeline before Phase 1 decides otherwise.
- Never commit real tokens, `.env` files, cookies, OAuth codes, private Parqet exports, real portfolio/depot data, private screenshots or debug logs with private API responses.
- Private local reference files may exist only in ignored paths such as `.local/`.
- If private data appears in a diff, the PR is blocked.
