# Development Workflow

Status: active for Phase 0

## Operating Model

The repository uses a simple collaboration model:

- Adrian owns product direction, merge decisions and private-data approval.
- ChatGPT helps shape issues, prompts and review plans.
- Codex implements bounded repository changes and reports verification.
- GitHub Issues, Pull Requests and CI are the operational record.

English is the source-of-truth language. German translation files are placeholders until a later Translation-Agent PR creates full translations.

## Codex Modes

Default mode: `Spar`.

- `Mini`: tiny low-risk documentation or mechanical changes.
- `Spar`: focused default work with limited scope.
- `Normal`: moderate work needing broader repository context.
- `Voll`: full-context mode for risky first tasks or cross-cutting work.
- `Folgeauftrag`: narrow follow-up in an existing context.
- `Review-Fix`: targeted review-feedback or CI-fix work.

Use `Voll` for risky first tasks involving auth/OAuth, tokens/cookies, API contracts, data pipeline, persistence, caching, CI/Branch Protection, security or large refactorings. Follow-up tasks in a narrow existing context do not automatically require `Voll`.

## Branch And Main Rules

- `main` should remain stable.
- Normal work should use branch plus pull request.
- Adrian may intentionally commit directly to `main` for small low-risk documentation changes.
- Direct `main` commits are not intended for app code, auth, API contracts, data pipeline, CI, security, architecture or large prompt/documentation changes.
- Branch Protection is documented but not activated in Phase 0.
- Auto-merge is not enabled in Phase 0.
- Later auto-merge may be considered for documentation or prompt-only changes after CI is reliable.

## Pull Requests

Every PR should include:

- goal,
- linked issues,
- Codex mode when relevant,
- whether Codex was involved,
- summary,
- changed files,
- verification,
- documentation impact,
- German translation check when a matching `.de.md` file exists,
- risk,
- rollback,
- what was intentionally not changed.

Use `Fixes #...` only when the PR fully closes an issue. Use `Refs #...` for parent issues, planning issues or partial progress.

## CI And Verification

Phase 0 CI runs:

```bash
npm run lint
npm run build
```

Do not add Vitest, Playwright, or `npm run test` in Phase 0. Documentation-only CI optimization is a later goal.

For local repository verification, run:

```bash
git status --short
git diff --stat
git diff --check
git diff --name-only
```

If lint or build is missing or failing, report the gap clearly and avoid broad cleanup unless the issue explicitly authorizes it.

## Vercel Deployments

Vercel may create deployments for pull requests and for changes merged into `main`.

The repository provides a conservative ignored-build helper:

```bash
npm run vercel:ignore-build
```

Configure this command in Vercel as the Ignored Build Step. The script skips Vercel builds only when all changed files are clearly documentation or governance files, such as `docs/**`, `prompts/**`, `.github/ISSUE_TEMPLATE/**`, `README.md`, `README.de.md`, `CHANGELOG.md` or `AGENTS.md`.

The script intentionally triggers a build when app-relevant or deployment-sensitive files change, including `src/**`, `app/**`, `components/**`, `lib/**`, `public/**`, `scripts/**`, dependency files, Next.js config, TypeScript config, `.env.example` or `.github/workflows/**`.

When the script cannot determine the changed files or sees an unknown path, it fails open and lets Vercel build. GitHub CI remains independent and should still run as configured.

## Security And Privacy

- No real tokens.
- No real `.env` files.
- No private Parqet exports.
- No real portfolio or depot data.
- No screenshots with real portfolio, account, depot or personal data.
- No cookies, OAuth codes, access tokens or refresh tokens in Issues, PRs or logs.
- No debug logs containing private API responses.
- Private local reference files may exist only in ignored paths such as `.local/`.
- `.local/` must be ignored and must not be committed.
- `.env.example` may exist with empty placeholders only.
- Anonymized real data requires manual approval by Adrian.
- Synthetic test data is allowed only in clearly named test folders.
- If private data appears in a diff, the PR is blocked.
- Auth/API/token changes require Full Review.

## Architecture Decisions

Use ADRs for major architecture and workflow decisions. ADRs are English only and live in `docs/adr/`.

The existing Parqet pipeline remains a guardrail: do not create a second activity or asset pipeline before Phase 1 decides otherwise.
