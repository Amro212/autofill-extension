# Agent Instructions & Operating Rules

## 1. Findings, Bugs, and Context Logging (MANDATORY)

Every agent interacting with this repository **MUST** maintain and update [CONTEXT_AND_FINDINGS.md](file:///c:/VScode/Autofill-Ext/CONTEXT_AND_FINDINGS.md):

1. **When the User Reports Bugs or Findings**:
   - Immediately log the details in [CONTEXT_AND_FINDINGS.md](file:///c:/VScode/Autofill-Ext/CONTEXT_AND_FINDINGS.md) under a new entry.
   - Include:
     - **Date & Phase Context**: Current date and current phase (e.g., Phase 2 / Phase 3 / Phase 4).
     - **Platform / Environment**: E.g., Lever, Ashby, Greenhouse, Workday, or synthetic fixture.
     - **Symptoms / Observed Behavior**: What failed, screenshots/examples, shifted or incorrect values.
     - **Audit & Root Cause Analysis**: Underlying DOM behavior, label extraction nuances, scanner or filler issues, AI prompt/payload mismatches.
     - **Target Phase for Resolution**: Whether it belongs to the current phase or is deferred to a future phase (e.g., Phase 4 ATS Hardening).

2. **Conversation Turn Changes**:
   - Document any changes made during a conversation turn in [CONTEXT_AND_FINDINGS.md](file:///c:/VScode/Autofill-Ext/CONTEXT_AND_FINDINGS.md):
     - Files modified or created.
     - Summary of changes and technical rationale.
     - Current phase status and next steps.

---

## 2. Global Agent Rules & Execution Principles

1. **Strict Phase Scope**: Work only on the active phase. Do not pre-build later phases except for a tiny abstraction strictly required by current work.
2. **Runnable Build Target**: Leave the project runnable after every phase. `npm run build` must produce `dist/job-copilot.user.js`.
3. **Runtime Constraints**: Runtime is only the user's normal browser + Tampermonkey + page DOM + GM APIs + OpenRouter.
4. **No External Backends or Controllers**: Do not add a backend, WXT, Selenium, Playwright runtime automation, or external browser controller. Playwright may be used only for deterministic development fixtures/tests.
5. **GM Storage Exclusivity**: Store core data in GM-managed storage, not page `localStorage` or `sessionStorage`.
6. **API Key Security**: Store the OpenRouter key only in GM-managed userscript storage. Never expose it to DOM, `window`, logs, debug exports, prompts, or page storage.
7. **Single UI Host**: Use one persistent Shadow DOM control panel.
8. **No Fake Human Behavior**: No typing animation, random mouse movement, random hesitation, stealth logic, fingerprint spoofing, or CAPTCHA bypass.
9. **Field Engine Pipeline**: `observe -> locate -> scroll -> act -> verify -> repair`.
10. **Unified AI Page Requests**: One normal page should use one primary AI request. Individual calls are reserved for Rewrite, repair, or late dynamic fields.
11. **Truthful Profile Grounding**: Do not invent applicant jobs, projects, dates, tools, certifications, metrics, achievements, or years of experience.
12. **Transparent Inferences**: Best-effort inference is allowed for unknown structured fields, but mark inferred values internally for review.
13. **Safety & Compliance Boundaries**: Pause autonomous progression for assessments, identity verification, recorded/video interviews, e-signatures, and explicit legal attestations.
14. **No CAPTCHA Solving**: Never solve CAPTCHA. Wait and resume if it clears normally.
15. **Bounded Retries**: Use bounded retries. Never create an infinite fill/navigation loop.
16. **License Preservation**: Preserve license notices for directly reused MIT/BSD code.
17. **Manual Phase Sign-off**: Commit/tag only after the user manually accepts a phase.
18. **No Unrequested Files**: Do not create miscellaneous markdown or other files unless explicitly requested. Only add or modify files when directly instructed.