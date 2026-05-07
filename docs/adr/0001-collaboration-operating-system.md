# ADR 0001: Collaboration Operating System

Status: accepted
Date: 2026-05-07
Owner: AdrianR98

## Context

The repository needs a stable collaboration baseline before larger product, architecture or CI work continues. Previous guidance existed in repository documents, but the project needs a clearer operating model for Adrian, ChatGPT, Codex, GitHub Issues, Pull Requests, CI and future agents.

## Decision

Use a documented collaboration operating system:

- Adrian remains the product owner and final decision maker.
- ChatGPT helps shape issues, prompts, decisions and review context.
- Codex implements bounded repository changes through explicit modes and reports verification.
- GitHub Issues track goals, acceptance criteria, non-goals, risks and links.
- Pull Requests remain the review and merge unit.
- CI starts with `npm run lint` and `npm run build`.
- Future agents are documented as manual-only placeholders until separately activated.

English is the source-of-truth language. German translations are separate follow-up work. Security and privacy guardrails block real secrets, tokens, private exports and real portfolio/depot data from Issues, PRs, logs and commits.

## Consequences

The repository gains a stable baseline for future work without changing product behavior. Larger work can now reference `AGENTS.md`, `prompts/`, issue templates, PR templates, ADRs and CI.

This does not activate Branch Protection, auto-merge or automated agents in Phase 0. Those require later decisions and PRs.
