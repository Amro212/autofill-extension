# Phase 3 Application Engine Implementation Plan

**Goal:** Implement the application workflow and eight acceptance gates in the supplied Phase 3 kit.

**Architecture:** A single workflow controller composes job capture, GM-backed sessions, page classification, validation, navigation, and answer memory. Reuse the Phase 2 scanner/fillers and existing Shadow DOM panel. Auto Continue defaults on after an explicit Start; final submission remains manual in Phase 3.

**Tech Stack:** JavaScript modules, Tampermonkey GM APIs, esbuild, node:test and jsdom deterministic fixtures.

## Design decisions

- Prefer a separate controller over expanding the UI's autofill loop: testable lifecycle and shared boundary guards. Avoid a general workflow framework: only the current phase needs support.
- Persist each session separately. Use GM tab identity and URL-matched recent-session fallback; never attach an arbitrary latest job. Store pending navigation before clicking.
- Classify visible page content before every fill/navigation and after async work. CAPTCHA waits resume automatically after clearance; user boundaries require manual intervention. Stop at review even if a saved Auto Submit setting is enabled.
- Validate native constraints, required/custom controls, associated ARIA errors, visible errors and disabled Continue. Rescan and locally reapply before one semantic AI repair per attempt; cap repair attempts and step count, including across refresh.
- Application memory stays in its session. Global memory uses exact normalized common profile questions and a profile fingerprint; reject inferred or incompatible choices.
- Observe DOM changes plus URL changes without patching page history. Coalesce execution; no parallel fills or repeated primary requests on unchanged steps.

## Execution checklist

1. Add failing deterministic tests for capture, continuity, memory isolation, validation, navigation and boundaries. Run `rtk npm test` and confirm missing Phase 3 behavior.
2. Add `src/jobs.js`, `src/sessions.js`, `src/pageClassifier.js`, `src/validation.js`, `src/navigation.js`, `src/memory.js`, and `src/application.js`.
3. Integrate controller with `src/ui.js`, job/repair context in `src/ai.js`, GM keys/reset in storage, and tab grants in `build.js`.
4. Add a deterministic multi-step HTML fixture with mocked AI for tests and ordinary userscript installation for manual use. Exercise validation rejection, CAPTCHA, assessment and review.
5. Run targeted tests, full tests, build and diff checks. Write `PHASE_3_REPORT.md` with manual instructions and limitations; update `CONTEXT_AND_FINDINGS.md`.

No commit/tag until user manually accepts the phase. No ATS-specific work or document generation.
