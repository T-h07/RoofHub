# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-05-05

### Added

- Stable baseline release for the RoofHub platform across public discovery, provider workflow, messaging, moderation, and company workspace flows.
- Launch-readiness quality gate coverage (`lint`, `typecheck`, `build`, `check:secrets`) for release verification.

### Changed

- Reworked top-level `README.md` into a production-facing front page with concise setup, security posture, and release workflow guidance.
- Simplified Supabase setup docs to avoid embedding example credential-like strings in Markdown where unnecessary.
- Set application version to `1.0.0` in `package.json` and `package-lock.json`.

### Security

- Performed repository security review focused on secret exposure risk in tracked docs.
- Confirmed tracked-file secret scan is clean.
- Reinforced documentation guidance to keep live credentials out of source control and out of public docs.

