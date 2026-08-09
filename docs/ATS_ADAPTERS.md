# ATS adapters

Job Copilot always runs the generic field, execution, validation, upload, and navigation engines. An adapter adds ATS detection, stable platform evidence, unsafe-control exclusions, and final-page rules; it never disables generic fallback.

## v1 support

| ATS | Status | Current public structure checked | Regression fixture |
| --- | --- | --- | --- |
| Workday | Supported | 2026-08-09 | `apps/extension/tests/fixtures/ats/workday.html` |
| Greenhouse | Supported | 2026-08-09 | `apps/extension/tests/fixtures/ats/greenhouse.html` |
| Lever, Ashby, iCIMS | Detected only | Not validated for v1 | None |

“Supported” means detection, fields, custom selects, dates, repeated sections where present, uploads, validation, and navigation are covered by adapter fixtures plus the shared verified multi-step browser suite. It does not mean every tenant customization is guaranteed.

The registry is in `apps/extension/src/adapters/registry.ts`. Unknown sites receive adapter ID `generic`.

## Safety rules

- Workday password/account controls and the `beecatcher` robot-only honeypot are excluded.
- A Submit-labelled control alone does not make a generic page final.
- Greenhouse’s single-page application is classified as final only through its explicit application-form adapter rule.
- CAPTCHA, assessment, identity, video, signature, and legal-attestation boundaries remain owned by the shared boundary engine.
- All actions still follow locate, scroll, act, observe, and verify.

See [Workday](ats/WORKDAY.md) and [Greenhouse](ats/GREENHOUSE.md) for evidence and limitations.
