# Commit Conventions

## Format

Use conventional-style commit messages:

`<type>(<scope>): <short imperative summary>`

Examples:

- `chore(repo): add baseline git hygiene files`
- `docs(repo): define repository workflow and commit policy`
- `feat(map): add listing pin clustering`
- `fix(search): handle empty location query`
- `refactor(api): split listing validator into modules`
- `ci(repo): add pull request checks`

## Recommended Types

- `chore`: maintenance/setup/non-feature changes
- `docs`: documentation changes
- `feat`: new user-facing behavior
- `fix`: bug fixes
- `refactor`: structural changes without behavior change
- `ci`: CI/workflow changes

## Atomic Commit Rules

- Commit only one logical unit of work per commit.
- Do not mix unrelated files in one commit.
- Keep commits reviewable and reversible.
- Avoid "WIP" or vague commit messages.
- Do not intentionally commit broken work.

## What Counts as a Logical Unit

A logical unit usually means one of:

- a complete config policy update
- a complete documentation update for one topic
- a complete behavior fix in one area
- a cohesive refactor with no behavior drift

If a change touches multiple concerns, split it into multiple commits.
