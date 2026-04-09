# Repository Workflow

## Purpose

This project uses a conservative Git workflow to keep history clean and prevent accidental commits of secrets, generated artifacts, or machine-local files.

## Branch Model

- `main`: stable/release-ready only.
- `dev`: integration branch for upcoming work.
- `feature/*`: feature implementation.
- `fix/*`: bugfixes.
- `chore/*`: repository/setup/maintenance.
- `docs/*`: documentation-only work.

## Branch Naming for PT Work

Use:

- `feature/nm-ptXX-short-slug`
- `fix/nm-ptXX-short-slug`
- `chore/nm-ptXX-short-slug`
- `docs/nm-ptXX-short-slug`

Example: `feature/nm-pt03-map-search-filters`

## Where to Branch From

- Start new work from `dev`.
- Do not branch from `main` for normal PT tasks.

## Where to Commit

- Commit on your working branch only (`feature/*`, `fix/*`, `chore/*`, `docs/*`).
- Do not commit directly to `main`.
- Avoid committing directly to `dev` unless explicitly coordinated.

## When to Commit

Commit only after a logically complete unit of work:

- one coherent behavior/config/documentation change
- passing local checks relevant to that change
- no unrelated file noise mixed in

## Push and Merge Rules

- Pushes should go to your working branch only.
- Merges into `dev` and `main` are manual by the repository owner.
- Keep history readable with clear, scoped commit messages.

## Security Gate for Sensitive Changes

For changes that touch auth/session, authorization, route handlers, server actions, uploads/storage, moderation/admin logic, messaging access rules, environment/secrets, or sensitive dependencies:

- follow `docs/security-baseline.md`
- complete `docs/security-checklist.md` before merge
- include tests or validation notes for the sensitive behavior change
- follow `docs/supply-chain-guardrails.md` for dependency/lockfile/scanner expectations

## Lockfile Discipline

- `package-lock.json` is required for reproducible installs.
- Dependency manifest changes (`package.json`) must include intentional matching lockfile changes.
- Do not remove or regenerate lockfile entries casually.
- Do not merge dependency changes that omit required lockfile updates.

## Security Workflow Changes

- Changes to `.github/workflows/security-*.yml` and `.github/dependabot.yml` are security-sensitive.
- Do not disable scanners or lower guardrail severity without explicit rationale in PR notes.
- Keep workflow naming and triggers consistent so security results remain discoverable.

## What to Commit

Commit:

- source code
- project configuration files
- migrations
- reusable scripts
- documentation
- lockfiles
- static assets used by the app
- template/example env files (for example `.env.example`)
- CI/workflow files (when added)

## What Not to Commit

Never commit:

- secrets or API keys
- real `.env` files
- local database dumps unless intentionally required
- `node_modules`
- build output (`.next`, `dist`, `build`, etc.)
- caches and temporary files
- editor/OS junk files
- temporary Supabase local state
- ad-hoc debug artifacts
- personal machine-specific config unless intentionally shared
