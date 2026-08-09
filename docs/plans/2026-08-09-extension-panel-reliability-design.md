# Extension Panel Reliability Design

## Goal

Keep Job Copilot visible after pairing, eliminate duplicate session lookup noise, and run contract validation without forbidden dynamic code.

## Design

- Mount once through WXT, then observe the document root and reattach the existing shadow host if page hydration disconnects it. Reusing the host preserves React state.
- Keep read-only runtime messages consistent between content and background. Reject malformed memory payloads at the UI boundary so an API contract failure cannot unmount React.
- Claim a page observation signature synchronously before async messaging; reset it only on failure.
- Treat a missing tab session as normal lookup data (`null`), not an HTTP error. Propagate real backend failures.
- Configure Zod's supported `jitless` mode in both extension entrypoints.

## Verification

Regression tests cover host reattachment, signature claiming/retry, nullable session recovery, lookup API behavior, and malformed memory payloads. Zod's jitless bootstrap is imported before contract schemas so its `Function()` capability probe is never executed under extension CSP. Then run lint, all typechecks/tests, both extension builds, and artifact-order checks.
