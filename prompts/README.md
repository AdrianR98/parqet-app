# Prompt Workflow

This directory contains the repository workflow prompts and task rules. `prompts/master-prompt.yaml` is shared project and agent guidance, not a ChatGPT-only prompt. Mode selection belongs to ChatGPT when it prepares a Codex task; Codex follows the supplied mode and does not choose or upgrade it. Codex never creates pull requests.

## Overall Workflow

```mermaid
flowchart TD
    A["Adrian raises idea, issue, bug or cleanup request"] --> B["ChatGPT clarifies goal, phase, scope and risks"]
    B --> C["ChatGPT prepares human-readable issue or chat-scoped task"]
    C --> D["ChatGPT selects Codex mode"]
    D --> E["ChatGPT writes Codex task prompt from codex-task-template.yaml"]
    E --> F["Codex reads required files for the supplied mode"]
    F --> G["Codex edits only allowed files"]
    G --> H["Codex runs scope-appropriate verification"]
    H --> I["Codex reports changed files, verification, risks and gaps"]
    I --> J["Adrian reviews with optional ChatGPT Review-Agent support"]
    J --> K["Adrian decides merge, follow-up or defer"]
```

## Issue Intake By ChatGPT

```mermaid
flowchart TD
    A["Input from Adrian"] --> B["Classify phase and issue type"]
    B --> C{"Product, data, privacy or security unclear?"}
    C -- "Yes" --> D["Ask clarifying questions before Codex"]
    C -- "No" --> E["Define scope, non-goals and acceptance criteria"]
    E --> F["State verification, API Budget Impact and Privacy/Data Impact"]
    F --> G["Choose Codex mode from task risk and file scope"]
    G --> H["Write Codex prompt with all required fields"]
    H --> I["Hand task to Codex"]
```

ChatGPT may act as Product-Agent, Architecture-Agent, Docs-Agent or Review-Agent during an active chat. It does not give Codex open-ended authority: the task prompt must define mode, branch, allowed changes, non-goals and verification.

## Codex Execution Flow

```mermaid
flowchart TD
    A["Receive Codex task prompt"] --> B{"All required fields present?"}
    B -- "No" --> C["Stop and report prompt is not ready"]
    B -- "Yes" --> D["Use provided branch and mode"]
    D --> E["Read AGENTS.md, quick rules and mode-specific files"]
    E --> F{"Scope exceeds mode or conflicts with non-goals?"}
    F -- "Yes" --> G["Stop and report blocker"]
    F -- "No" --> H["Make bounded edits"]
    H --> I["Run verification profile for changed files"]
    I --> J["Run git diff --check"]
    J --> K["Report changed files, checks, risks and gaps"]
```

Codex may create local branch changes when the task gives a branch and allowed changes. Codex does not create PRs, close issues, set GitHub metadata, merge or widen scope.

## Mode Overview

```mermaid
flowchart LR
    A["Mini"] --> B["Tiny docs, wording or mechanical changes"]
    C["Spar"] --> D["Default focused task, up to 6 files"]
    E["Normal"] --> F["Moderate task, broader context, up to 10 files"]
    G["Voll"] --> H["Risky first task or broad cross-cutting work"]
    I["Folgeauftrag"] --> J["Narrow follow-up in existing context"]
    K["Review-Fix"] --> L["Targeted review or CI fix"]
```

Use `Voll` for risky first tasks touching auth/OAuth, tokens/cookies, Parqet API contracts, data pipeline, persistence, caching, security, Branch Protection or large refactors. Use at least `Normal` for medium governance updates, scripts, package changes, workflow changes or new test setup.

## Mode-Specific Read Sets

```mermaid
flowchart TD
    A["Mini"] --> A1["AGENTS.md"]
    A --> A2["Explicitly named files"]

    B["Spar"] --> B1["AGENTS.md"]
    B --> B2["prompts/codex-quick-rules.yaml"]
    B --> B3["Relevant files only"]

    C["Normal"] --> C1["AGENTS.md"]
    C --> C2["prompts/codex-quick-rules.yaml"]
    C --> C3["prompts/codex-task-template.yaml"]
    C --> C4["prompts/codex-execution-rules.yaml"]
    C --> C5["Relevant files selected with targeted search"]

    D["Voll"] --> D1["AGENTS.md"]
    D --> D2["prompts/master-prompt.yaml"]
    D --> D3["prompts/codex-quick-rules.yaml"]
    D --> D4["prompts/codex-task-template.yaml"]
    D --> D5["prompts/codex-execution-rules.yaml"]
    D --> D6["prompts/workflow-chatgpt-codex.yaml"]
    D --> D7["docs/DEVELOPMENT_WORKFLOW.md"]
    D --> D8["docs/PROJECT_STATUS.md"]
    D --> D9["Relevant ADRs"]
```

These read sets are implementation context, not a complete merge gate. Review and merge checks may require additional documents from `docs/DEVELOPMENT_WORKFLOW.md`, `docs/V1_GUARDRAILS.md`, ADRs or issue-specific references.
