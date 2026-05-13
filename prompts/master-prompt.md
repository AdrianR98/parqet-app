# Master Prompt

This document explains the compact shared project and agent rules in `prompts/master-prompt.yaml`.

## Purpose

Codex-assisted work in this repository must be conservative, reviewable and issue-linked. The repository currently needs a stable collaboration and operating baseline before further product work continues.

Phase 0 is not a product feature phase. It establishes documentation, prompts, templates, ADR structure, CI foundation and security guardrails.

`prompts/master-prompt.yaml` is shared project/agent guidance for Adrian, ChatGPT, Codex and future agents. It is not a ChatGPT-only prompt. More specific Codex execution details live in `prompts/codex-execution-rules.yaml`, `prompts/codex-task-template.yaml` and `prompts/workflow-chatgpt-codex.yaml`.

## Source Of Truth

English is the source-of-truth language for repository documentation and decisions. German files may exist as placeholders, but they must not introduce decisions that are absent from the English source.

ADRs are English only. `CHANGELOG.md` starts English only.

## Product Guardrail

The Parqet App already has an existing activity and asset pipeline direction. Do not create a second competing activity or asset pipeline before Phase 1 explicitly decides otherwise.

Any future work touching Parqet activity data, asset projections, overrides, reconciliation, caching, auth, tokens or API contracts must use the required Codex mode and document risks clearly.

## Codex Modes

- `Mini`: tiny documentation, typo, formatting or mechanical updates.
- `Spar`: default mode for focused work with clear scope.
- `Normal`: moderate tasks needing more context across files.
- `Voll`: full-context mode for risky first tasks or cross-cutting work.
- `Folgeauftrag`: narrow follow-up in an already established context.
- `Review-Fix`: targeted response to review comments.

Use `Voll` for risky first tasks involving auth/OAuth, tokens/cookies, API contracts, data pipeline, persistence, caching, CI/Branch Protection, security or large refactorings. A narrow follow-up task does not automatically require `Voll`.

## Required Behavior

Codex should:

- read relevant files before editing,
- keep changes small and bounded,
- avoid unrelated refactors,
- preserve app behavior unless explicitly asked to change it,
- report verification results honestly,
- state gaps instead of silently widening scope,
- block PRs that include private data.

## Security And Privacy

Never commit real tokens, real `.env` files, cookies, OAuth codes, access tokens, refresh tokens, private Parqet exports, real portfolio/depot data, private screenshots or debug logs containing private API responses.

Private local reference files may exist only in ignored paths such as `.local/`. `.env.example` may contain empty placeholders only.

Anonymized real data requires manual approval by Adrian. Synthetic data is allowed only in clearly named test folders.
