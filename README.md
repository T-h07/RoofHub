# NestMap

Map-first real estate marketplace for rental and sale listings.

## Repository Status

This repository is currently in pre-feature setup mode.  
Current focus: repository governance, Git workflow, and contribution rules.

## Branch Model

- `main`: stable, release-ready only.
- `dev`: integration branch for upcoming work.
- `feature/*`: feature development branches.
- `fix/*`: bugfix branches.
- `chore/*`: repository/setup/maintenance branches.
- `docs/*`: documentation-only branches.

## Contribution Workflow (Current)

1. Branch from `dev`.
2. Use the naming convention: `feature|fix|chore|docs/nm-ptXX-short-slug`.
3. Commit only complete, atomic units.
4. Push only your working branch (not `main`).
5. Merges into `dev`/`main` are handled manually by the repository owner.

`main` is conceptually protected as stable-only.

## Documentation

- Repository workflow: `docs/repository-workflow.md`
- Commit conventions: `docs/commit-conventions.md`
