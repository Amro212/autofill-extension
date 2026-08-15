# Master Execution Plan

The previous one-shot failed because too many systems were built simultaneously. This plan proves one risky layer at a time.

```text
Phase 1: Can Tampermonkey host the product reliably?
    ↓
Phase 2: Can it understand and fill one page reliably?
    ↓
Phase 3: Can it manage a multi-page application?
    ↓
Phase 4: Can it survive real ATS quirks?
    ↓
Phase 5: Can it own documents and AI tailoring without a backend?
    ↓
Phase 6: Can it become a stable daily-use tool and future outreach base?
```

## Workflow for every phase

1. Give Codex:
   - `GLOBAL_AGENT_RULES.md`
   - the current phase file
   - the current codebase
   - relevant previous phase report
2. Codex implements **only that phase**.
3. Codex builds `dist/job-copilot.user.js`.
4. Install/update it in Tampermonkey.
5. Execute the manual checklist in the current phase file.
6. If any HARD GATE fails, do not continue. Use `FAILURE_FEEDBACK_PROMPT.md`.
7. Once all gates pass:
   - commit
   - tag the phase
   - proceed to the next phase.

## Phase tags

```text
phase-1-foundation-pass
phase-2-generic-autofill-pass
phase-3-application-engine-pass
phase-4-ats-hardening-pass
phase-5-documents-pass
phase-6-v1-pass
```

## Scope control until v1 passes

Do not add:
- cloud backend
- browser-extension architecture
- multi-user SaaS
- billing
- automated email sending
- recruiter scraping
- CRM
- analytics dashboard

Outreach becomes the next product module only after the application foundation is stable.
