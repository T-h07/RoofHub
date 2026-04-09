# Supply Chain Guardrails (SH-PT07)

This document defines the repository-level guardrails for secret hygiene, dependency risk, and code scanning.

It is intentionally practical: a small set of enforceable checks with clear ownership and low operational noise.

## Baseline controls

### 1) Secret scanning

- Workflow: `.github/workflows/security-secrets.yml`
- Tool: `gitleaks/gitleaks-action`
- Trigger:
  - pull requests to `main` and `dev`
  - pushes to `main` and `dev`
  - weekly schedule
  - manual dispatch

Purpose:
- catch committed secrets and credential-like patterns early
- block merges/pushes when a likely secret leak is introduced

Examples of leaks this is meant to catch:
- API keys, tokens, service-role keys
- OAuth secrets
- accidental credential commits in source/config/docs

### 2) Dependency vulnerability scanning

- Workflow: `.github/workflows/security-dependencies.yml`
- Tools:
  - `actions/dependency-review-action` on PR dependency changes
  - scheduled `npm audit --package-lock-only --omit=dev --audit-level=high`

Purpose:
- block PRs that introduce high/critical vulnerable dependencies
- provide recurring visibility into known production dependency vulnerabilities from the lockfile graph

### 3) Code scanning

- Workflow: `.github/workflows/security-codeql.yml`
- Tool: GitHub CodeQL (`javascript-typescript`)
- Trigger:
  - pull requests to `main` and `dev`
  - pushes to `main` and `dev`
  - weekly schedule
  - manual dispatch

Purpose:
- surface common JavaScript/TypeScript security issues (injection, unsafe data flow, risky API usage, etc.)
- provide a maintainable baseline for App Router and server/client mixed codebases

### 4) Automated update hygiene

- Config: `.github/dependabot.yml`
- Scope:
  - `npm` ecosystem updates
  - GitHub Actions updates
- Target branch: `dev`
- cadence: weekly
- noise control:
  - grouped npm patch/minor updates
  - bounded open PR limits

## Lockfile and dependency discipline

- `package-lock.json` is required source of truth for reproducible installs.
- Dependency changes in `package.json` must include matching intentional lockfile updates.
- Do not regenerate lockfile without reason.
- Prefer `npm ci` in CI/automation paths for deterministic installs.
- Never bypass dependency checks by removing lockfile changes from PRs.

## Package addition review rules

Before adding a new package, answer all of the following:

1. Is a new dependency necessary, or can current code/deps solve it safely?
2. Is the package actively maintained and widely trusted?
3. Does it expand attack surface (networking, parsing, rendering, auth, crypto, upload, execution)?
4. Are licensing and transitive dependencies reasonable for this repo?
5. Could this package expose secrets, change trust boundaries, or weaken validation?

Extra scrutiny is mandatory for packages touching:
- auth/session
- crypto/security
- file upload/storage
- input parsing/serialization
- HTML/markdown rendering
- network clients/proxies

## Handling findings

For any scanner finding:

1. Confirm if it is a real issue or a false positive.
2. If real:
   - remove/revoke leaked credentials immediately for secret findings
   - patch/upgrade/replace vulnerable dependencies
   - fix or contain risky code paths for CodeQL findings
3. If false positive:
   - document why in PR notes
   - prefer narrow, explicit suppression only
   - do not disable whole workflows to silence one alert

Non-negotiable rules:
- do not suppress scanner findings without documentation
- do not disable security workflows casually
- do not merge known secret leaks

## Branch protection recommendation

Repository settings should require successful checks for:
- `Security - Secret Scanning`
- `Security - Dependency Guardrails`
- `Security - Code Scanning`

This is a settings-level control (not enforceable only from repo files), but should be applied by maintainers.

## Known limits and intentional deferrals

This baseline does not yet include:
- SBOM generation/signing
- provenance attestations
- organization-wide policy engines
- custom Semgrep rule packs

These can be added in later security PTs if they provide clear value without excessive noise.
