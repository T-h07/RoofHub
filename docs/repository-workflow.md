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

## What to Commit

Commit:

- source code
- project configuration files
- migrations
- reusable scripts
- documentation
- lockfiles
- static assets used by the app
- sanitized environment templates (only when intentionally maintained)
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
