# AI Workflow Adoption (Docs-Only)

This document records which external AI workflow ideas are adopted in this repository and which are explicitly not adopted.

## Scope And Constraints

- This adoption is documentation-only guidance.
- No runtime dependencies are added.
- No app behavior changes are introduced.
- No external tool lock-in is required for contributors.

## External Inputs Reviewed

- `mattpocock/skills` (workflow pattern ideas)
- `Understand-Anything` (local codebase analysis workflow ideas)
- `stop-slop` style guidance (quality gates to avoid vague AI output)

## Adopted Practices

1. Task framing before execution:
- Require explicit scope, non-goals, acceptance criteria, verification profile, API budget impact, and privacy/data impact in task prompts.

2. Risk-based execution modes:
- Keep the existing mode discipline (`Mini`, `Spar`, `Normal`, `Voll`, etc.) and use higher scrutiny for broad or risky changes.

3. Guardrails-first edits:
- Preserve existing product guardrails, privacy boundaries, and API-budget constraints as first-class requirements.

4. Documentation of shared domain language:
- Maintain a dedicated domain vocabulary file to reduce ambiguous terms in AI-assisted implementation discussions.

5. Optional local structural analysis:
- Allow local analysis tooling for developer understanding, but keep output out of version control and out of official runtime flows.

6. Anti-slop quality expectation:
- Require concise, concrete change summaries and explicit verification outcomes instead of broad generic narratives.

## Explicitly Not Adopted

1. No repository installation of external skills packs:
- Do not install `mattpocock/skills` into this repository.

2. No repository installation of Understand-Anything:
- Do not add runtime/setup dependency on Understand-Anything for normal development.

3. No generated graph artifacts in git:
- Do not commit `.understand-anything` outputs (`knowledge-graph.json`, `meta.json`, `.understandignore`, or related intermediate files).

4. No CI/workflow lock-in:
- Do not add required CI jobs or automation that depend on external AI workflow tools.

5. No behavior changes:
- Do not change Parqet OAuth/API behavior, market-data workflows, Product Read Model behavior, or runtime routes as part of this adoption.

## Optional Local Tooling Note

Understand-Anything may be used locally as optional analysis tooling to inspect architecture or code relationships. It is not part of the repository runtime contract and must not produce committed artifacts.

## Privacy And API-Budget Alignment

- Use synthetic examples in docs and prompts.
- Never commit private portfolio exports, tokens, cookies, screenshots, or local graph outputs.
- Treat API budget minimization as a product and architecture rule.
