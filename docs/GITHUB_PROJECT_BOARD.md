# GitHub Project Board

Status: active guidance for Phase 0.1

## Purpose

The GitHub Project Board is the working view for active Parqet App work. It helps track issue flow, phase ownership and priority without replacing GitHub Issues as the source of truth.

Issues remain the durable source of truth. The Project Board is an operational view.

## Project

Project name:

```text
Parqet App
```

Scope:

```text
Account-wide GitHub Project, used only for AdrianR98/parqet-app.
```

## Fields

### Status

Use these values:

```text
Backlog
Specifying
Ready
In Progress
In Review
Done
```

Meaning:

| Status | Meaning |
| --- | --- |
| Backlog | Captured, not actively specified or worked. |
| Specifying | Being clarified in ChatGPT or issue comments. |
| Ready | Scope is clear enough for work or a Codex prompt. |
| In Progress | Work has started. |
| In Review | A PR or manual review is active. |
| Done | Issue is completed, superseded or intentionally closed. |

### Phase

Use these values:

```text
P0.1
P1
Backlog
Later
```

Meaning:

| Phase | Meaning |
| --- | --- |
| P0.1 | Workflow hardening and agent readiness. |
| P1 | Product, architecture and pipeline decisions. |
| Backlog | Captured but not assigned to a phase. |
| Later | Intentionally deferred. |

### Priority

Use these values:

```text
High
Medium
Low
None
```

Default priority: `None`.

Priority labels are not used for now. Priority lives in the issue text or Project field.

## Labels

Allowed baseline labels:

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

Guidelines:

- Do not create free-form labels without a separate decision.
- Do not create priority labels for now.
- The Issue-Agent may use only the allowlist above.
- Missing allowlist labels may be created once during setup if GitHub permissions allow it.

## Board Rules

- Add open issues to the Project Board.
- Add both Parent-Issues and Sub-Issues.
- Do not add PRs to Project Board v1.
- Use labels and issue content for type/category.
- Do not create a separate Type field in Project Board v1.
- Do not use a dedicated Blocked status. Use the `blocked` label or issue text.
- Closed issues should move to `Done`.
- Done issues may be archived after 30 days.

## Allowed Automations

GitHub-native automation may be used for low-risk board bookkeeping:

- New issues are added to the Project with Status `Backlog`.
- Closed issues move to Status `Done`.
- Done issues may be archived after 30 days.

Custom Issue-Agent automation is separate from GitHub-native automation and must follow the agent permission rules in `prompts/workflow-chatgpt-codex.yaml` and `docs/DEVELOPMENT_WORKFLOW.md`.

## Parent/Sub-Issues

Use both when available:

- native GitHub Parent/Sub-Issue relationships,
- Parent-Issue checklists for readability and fallback.

If native relationships are not available through the UI/API, use the Parent-Issue checklist as the fallback.

## Manual Setup Guide

Use this guide if GitHub Project or label setup cannot be completed through an API connector.

### 1. Create the Project

1. Open GitHub.
2. Go to the account-level Projects area.
3. Create a new Project named `Parqet App`.
4. Use a table or board layout, whichever is easier to maintain.
5. Restrict its practical use to `AdrianR98/parqet-app`.

### 2. Create fields

Create or configure these fields:

```text
Status: Backlog, Specifying, Ready, In Progress, In Review, Done
Phase: P0.1, P1, Backlog, Later
Priority: High, Medium, Low, None
```

### 3. Add issues

Add active open issues from `AdrianR98/parqet-app`, including:

- Parent issue #39,
- Sub-Issues #45 and #48 while Phase 0.1 is active,
- future Phase 1 Parent/Sub-Issues.

Closed Phase-0.1 Sub-Issues may be added as `Done` if historical completeness is useful, but this is optional.

### 4. Configure low-risk automation

If GitHub offers the automation safely in the UI, configure:

- newly added or newly created issues -> `Backlog`,
- closed issues -> `Done`,
- optional archive of `Done` items after 30 days.

Do not configure automation that edits issue body text, closes issues without PR completion, or changes repository files.

### 5. Create missing labels

Create only missing labels from the allowlist. Do not create labels outside the allowlist without a separate issue or explicit decision.

## Connector Capability Result

During Phase 0.1 setup, the available GitHub connector did not expose Project-v2 creation, Project-field management, native Parent/Sub-Issue relationship management, label listing or label creation tools.

Because of that, this issue is satisfied by documenting the manual setup guide and preserving the fallback rules. If these connector capabilities become available later, setup may be automated in a separate follow-up issue.
