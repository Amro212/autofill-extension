# Phase 3 — Application Engine

## v0.3.4 — Wait for navigation readiness

Reproduced a disabled-button pause after a slow save: the fixed post-click delay expired before the next step rendered, then the controller misrouted the disabled button into field repair. Workflow now polls for a changed, briefly stable step with available fields and no visible `aria-busy` region, or for the existing button to become enabled before clicking. Waiting is bounded to 10 seconds and respects Pause, review and boundaries. Real field validation errors still go through repair; disabled buttons do not consume AI repair attempts. Timeout wording explicitly refers to the page button, not the Auto Continue preference.

Five new tests cover delayed saving, delayed button readiness, permanent disablement, cancellation during waiting and staged busy rendering. Full suite: 64 passed. Build: v0.3.4. Only workflow controller behavior changed in this update; Phase 2 scanner/label/filler code was not changed. Live Workday retest remains pending.

## v0.3.3 — Workday same-step dropdown pause

Reproduced the reported sequence in a regression fixture: an `aria-labelledby` reference to the dropdown itself appends `Select One` to the question; selecting `Yes` changes the question label and therefore the page signature. The controller incorrectly pauses as if navigation happened. Label extraction now omits the control and selected-value descendants from referenced question text. Header/navigation/footer controls are excluded from applicant scanning. H3 headings now distinguish same-URL application steps.

New end-to-end regression fills the dropdown and remaining question, clicks Save and Continue, fills the next same-URL step, then stops at review without a second Start. All 59 tests pass; v0.3.3 build succeeds. Authenticated live Workday retest remains pending. Update the userscript, reload, keep Auto Continue ON and press Start / Resume once. Genuine unexpected page changes and validation/boundary failures still pause.

## 2026-09-15 acceptance fix update

- User confirms custom simulation works; real Workday rollback and Greenhouse CAPTCHA blocking reported. Real ATS acceptance remains pending.
- New build removes blanket CAPTCHA classification. Background badges/widgets no longer block ordinary autofill. CAPTCHA response fields are excluded from applicant fields. Site validation and manual final submission remain in place.
- Shared dropdown fixes remove synthetic Escape cleanup, prevent implicit native form submissions from dropdown clicks, recognize button dropdowns and their selected labels.
- Added field/navigation action logs (field metadata and route, no answer values) and pause on unexpected page change during workflow filling.
- Cisco authenticated application was not accessible from the inspection browser; live page showed account/sign-in. Workday rollback cause remains unconfirmed until retested with the new build.
- **Supersedes CAPTCHA steps below:** The original fake challenge-only page now pauses because it has no application fields. Remove it manually and press Start / Resume. On ordinary forms with a background CAPTCHA badge, filling must proceed without a CAPTCHA status block.

**Status:** Accepted & Signed off by user (Phases 1, 2, and 3 Complete).
**Build:** `dist/job-copilot.user.js`, version **0.3.7**.
**Validation:** `npm test`: **79 passed, 0 failed**. `npm run build`: passed. Bundled panel tests, multi-step application workflow, pause mechanics, and profile management verified.

## Delivered

- Job capture: JSON-LD JobPosting with DOM fallback; title, company, uncertainty flag, location, job ID, description, listing URL and application URL stored in GM storage and shown in the panel.
- Persistent application sessions: separate records for job context, answers, errors, page history, status, timestamps, request/repair/navigation counts. GM tab binding plus URL-matched fallback; constrained recovery for recent same-application POST redirects.
- Workflow: explicit Start / Resume, Pause, default-on Auto Continue, visible status and error details. Existing Autofill This Page remains available for one-page use.
- Validation: required controls, native validity, ARIA errors, visible inline errors, unsupported required uploads and disabled navigation. Rescan, local reapply, semantic AI repair, verification and bounded retry.
- Navigation: one unambiguous Next / Continue / Save and Continue / Review control; validate before click and check that the step changed. Stops at review, CAPTCHA, assessments, identity checks, recorded interviews and explicit legal attestations. Final submission remains manual in Phase 3.
- Memory: normalized question/type/context matching within each application. Only a small allowlist of common profile questions shares verified, non-inferred answers globally; profile changes and incompatible options invalidate reuse.
- Security: stored OpenRouter key is no longer copied into the Settings DOM. A blank replacement input preserves the saved key; newly entered replacement is cleared after saving. AI job/repair payload test checks that the key is absent.

## Retry limits

- One successful primary request per detected step; at most two attempts after failure/interruption.
- At most two repair rounds per step, each with local reapply and at most one semantic repair request.
- At most three navigation clicks per step, thirty per session, and forty controller passes per invocation.
- Unchanged steps without validation feedback pause after one click. Counters survive refresh. CAPTCHA waits do not consume request/navigation attempts.

## Manual test setup

1. Update Tampermonkey with `dist/job-copilot.user.js`. Confirm panel shows v0.3.4.
2. Configure your actual profile and OpenRouter key. Auto Continue on; Auto Submit stays disabled.
3. Serve development fixtures from the repository root:

   ```powershell
   python -m http.server 8765 --bind 127.0.0.1
   ```

4. Open `http://127.0.0.1:8765/fixtures/phase3-application-fixture.html?scenario=validation` in your normal Zen/Firefox browser with Tampermonkey enabled for that address. The static server is only for development testing; the installed userscript does not depend on it.
5. Click **Capture Job** in the panel. Confirm Software Engineer / Example Fixture Company. Click the page's **Apply now**, then panel **Start / Resume**.
6. Watch contact fields fill, then experience. The fixture deliberately rejects the first experience answer. Confirm a repair message, corrected answer, retry, and stop at **Review application**. Do not submit during this check.
7. Test refresh on a step, including with Auto Continue off; session ID, job and previous answers/history must remain. Turn Auto Continue on and press Start / Resume to continue.
8. Repeat with `?scenario=captcha`. The fake CAPTCHA must pause. Click **Remove fake challenge**; workflow should resume automatically.
9. Repeat with `?scenario=assessment`. Assessment input must remain empty; workflow must pause with its reason. Its Continue button must not be clicked by Job Copilot.
10. Repeat with `?scenario=stuck`. Review button deliberately does nothing; workflow must stop instead of clicking repeatedly.

## Hard gates accepted by user
 
- [x] Gate 1 — Real listing capture, description and uncertainty display.
- [x] Gate 2 — Listing-to-application linkage, refresh and next-step continuity.
- [x] Gate 3 — Correct rejected field, visible bounded repair and verified retry.
- [x] Gate 4 — Automatic step 1 → step 2 → review.
- [x] Gate 5 — Review stop with no final submission.
- [x] Gate 6 — Fake CAPTCHA pause and automatic resume after removal.
- [x] Gate 7 — Assessment pause with no answer/advance.
- [x] Gate 8 — Common answer reuse; employer-specific narratives stay isolated.

## Known limits

- Classification is generic and conservative. A form already showing a final Submit control is treated as review by the workflow; **Autofill This Page** can still fill it after boundary checks, with manual submission.
- Slow or ambiguous transitions pause for manual inspection. Unknown cross-origin redirects and unrelated/ambiguous shared endpoints do not automatically attach the latest session. Recent tab-bound redirect recovery requires the same stable application route and unchanged identity query parameters.
- Real CAPTCHA widgets may remain visible after successful completion; if the page does not remove/hide the detected challenge, workflow keeps waiting. No CAPTCHA interactions or solving are performed.
- Boundaries require manual intervention; only CAPTCHA wait automatically resumes. Required uploads remain manual until Phase 5.
- Global memory intentionally covers a small exact list of common profile questions. Phase 6 owns broader memory management/history polish.
- Lever label/answer misalignment remains assigned to Phase 4. No ATS adapter work was added.
- Automated tests use jsdom and mocked GM/OpenRouter responses, not a real browser or live OpenRouter service. Manual acceptance is essential.

Signed off by user. Phase 1, Phase 2, and Phase 3 are complete. Ready for Phase 4 (ATS Hardening).
## v0.3.9 — Stable workflow steps and bounded form reconciliation

Approved correction to the Workday false page-change pause. Workflow identity now distinguishes actual URL/active-step/step-heading transitions from ordinary field roster changes. Static question labels take precedence over selected-value aria-label text inside the workflow only. Conditional fields and transient rerenders settle within a bounded wait; up to two late-field requests share the same step's persistent budgets. Transient listbox search controls do not become applicant questions. Ambiguous replacement, duplicate IDs and changed question semantics stop stale writes and navigation.

Completion counts now reflect verified advancement, including review and full-document reload recovery, instead of counting scan snapshots. Debug shows a retained Last Workflow Change with structural differences and the triggering action, without answer values. Saved sessions use identity version 2; older sessions explicitly require Capture Job once rather than merging incompatible step keys. Shared Phase 2 scanner, labels, fillers and verifier are unchanged.

Verification: **103 tests passed, 0 failed**, including 24 additional tests for same-step mutation, Workday-style language selection, dynamic fields, Resume, stale answers, retry budgets, disabled controls, rerendering, full reload and bundled UI diagnostics. Independent review findings were reproduced and corrected. `npm run build` produced **v0.3.9**. No commit/tag performed. Live RBC Workday confirmation of this correction remains pending; prior phase sign-offs below are preserved.

Retest: install `dist/job-copilot.user.js`, reload Workday, **Capture Job once**, enable Auto Continue and press Start / Resume. If it pauses, copy both Last Workflow Change and Recent Activity Logs from Debug. Final review/submission remains manual.
