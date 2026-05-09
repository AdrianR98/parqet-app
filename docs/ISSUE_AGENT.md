# Issue-Agent v1

Status: manual-only workflow

## Purpose

Issue-Agent v1 is a constrained metadata helper for GitHub Issues. It can inspect one issue, classify it against the repository label allowlist, and optionally apply safe metadata changes.

The agent is intentionally manual-only in v1. It does not run on `issues.opened` or `issues.edited`.

## Workflow

Run from GitHub Actions:

```text
Actions -> Issue Agent -> Run workflow
```

Inputs:

```text
issue_number: target issue number
mode: dry-run | apply
```

Default mode: `dry-run`.

## Dry-run mode

Dry-run mode performs no mutations.

It may:

- fetch the target issue,
- classify the issue body and title,
- report proposed labels,
- report missing standard sections,
- report whether a body update would be needed.

## Apply mode

Apply mode may:

- create missing labels from the allowlist,
- add allowlisted labels to the target issue,
- append missing empty standard sections only for template-like/planning issues,
- add or update one idempotent Issue-Agent summary comment.

## Label allowlist

```text
phase
feature
bug
tech-debt
documentation
governance
agent
ci
architecture
security
data
ui
needs-decision
ready-for-codex
blocked
```

## Body update rule

Issue body updates are allowed only when all conditions are true:

- mode is `apply`,
- the issue looks like one of the repository's planning/template issues,
- missing sections can be appended as empty headings,
- existing user-provided content remains unchanged.

For non-template issues, the body must not be changed.

## Hard limits

Issue-Agent v1 must not:

- close issues,
- create issues,
- create pull requests,
- rewrite user-provided content,
- change acceptance criteria meaning,
- change priority meaning,
- set GitHub Project fields,
- set native Parent/Sub-Issue relationships,
- modify repository files during workflow execution,
- touch app/product code.

## Idempotency

The agent uses an `issue-agent:v1` marker for its summary comment and template-section additions. Repeated `apply` runs should update the existing summary comment instead of creating duplicates.

## Recommended first test

Run `dry-run` on a known planning issue first. Use `apply` only after the proposed labels and missing sections look correct.
