# Reference Source Audit

Phase 0 inspected all donors required by `job_copilot_implementation_kit/SOURCE_REUSE_AUDIT.md` at the commits below. Clones remain under ignored `references/` and will never become runtime dependencies.

| Donor | Commit | License evidence | Decision |
| --- | --- | --- | --- |
| FormPilot | `1b40c228b151894011af81c3a3230bad2a48fc90` | MIT `LICENSE` | Adapt contracts, native setters, fallback cascade, memory/signatures, bounded SPA observation, Shadow DOM mounting; preserve MIT notice if code is ported. |
| AI Form Filler | `e5e066b3f50287c59a653e253bf47be2a6eddd3f` | MIT `LICENSE` | Primary generic discovery/execution evidence. Reimplement behind typed isolated-world contracts; preserve MIT notice for substantial ports. |
| Job App Filler | `6d6062cb98bbe70c2946d9d43b519a01b19da448` | BSD-3-Clause text in `LICENSE.md` | Adapt Workday/Greenhouse signals and algorithms, not architecture or private React internals. Preserve BSD notice for substantial ports. |
| Autofill-Jobs | `a82a3165856ff461f8fd8f97811695636e11215e` | MIT `LICENSE` | Use only DataTransfer/File and historical selector evidence. Reimplement and verify; donor contains material bugs. |
| job-autofiller | `c7d7fd6aa61991b369d188418bfd6af9563081e4` | No license found | Conceptual selector/data separation only. Copy no code or mappings. |
| Simplify extension take-home | `92632033c1f89f81f0cad5b5abc6bc78c2d213ae` | No license found | Architectural validation from public assignment text only. Copy no starter code. |

## Cross-donor decisions

- One normalized serializable field contract replaces donor-specific answer/storage types.
- ATS scanners enhance generic scanning; they never disable fallback. FormPilot proves this failure-containment pattern.
- Element references stay in isolated content runtime. A narrow, schema-validated, per-page channel invokes main-world behavior only when evidence shows it is required.
- Exact visible-option match precedes normalized/fuzzy matching. Options must be visible, associated with the opened widget, and stable after async loading.
- Every action adds scroll, read-back, reconciliation wait, second read-back, and bounded alternative strategies. Donors often equate event dispatch or click with success; Job Copilot will not.
- Donor provider and local-storage architectures are rejected. Provider credentials, applicant context, durable memory, and documents remain in the authenticated backend.
- No source has sufficient current ATS tests to justify support claims. Job Copilot must create its own current regression fixtures and evidence docs.

Detailed evidence and decisions:

- [FormPilot](reference-audit/form-pilot.md)
- [AI Form Filler](reference-audit/ai-form-filler.md)
- [Job App Filler](reference-audit/job-app-filler.md)
- [Autofill-Jobs](reference-audit/autofill-jobs.md)
- [job-autofiller](reference-audit/job-autofiller.md)
- [Simplify extension take-home](reference-audit/simplify-extension-take-home.md)

## Attribution policy

No donor code has been copied during Phase 0. If later implementation substantially ports MIT/BSD code, add the donor copyright/license text to root `NOTICE.md` and preserve required source headers. Concepts, public API shapes, and independently reimplemented behavior will still cite this audit for provenance.
