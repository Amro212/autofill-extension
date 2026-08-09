# Simplify Extension Take-Home Audit

## Evidence

- Repository: `https://github.com/SimplifyJobs/extension-take-home`
- Commit: `92632033c1f89f81f0cad5b5abc6bc78c2d213ae`
- License: none found.
- Stack: cross-browser React/TypeScript webpack starter.

The README describes sequential user-visible steps: locate a control, perform one or more actions, and mark a step filled only when the next page or checked state proves completion. Bonus JSON expresses named steps with structured paths and ordered actions. The starter content/background files contain only empty render and click logging; no automation engine is donated.

## Test evidence

No tests and no implemented action runner. Build tooling targets Firefox and Chromium through manifest preprocessing but provides no behavioral evidence.

## Decision

Use assignment text only as architectural validation for structured sequential actions and verified status transitions. Job Copilot will use runtime element IDs rather than model-authored XPath, and each action will carry explicit verification and retry policy. Copy no code because repository has no license and starter offers no relevant implementation.

## Attribution

No code reuse permitted without a license grant. Concept credited in this audit only.
