# Phase 3 — Application Engine

## 2026-09-15 acceptance fix update

- User confirms custom simulation works; real Workday rollback and Greenhouse CAPTCHA blocking reported. Real ATS acceptance remains pending.
- New build removes blanket CAPTCHA classification. Background badges/widgets no longer block ordinary autofill. CAPTCHA response fields are excluded from applicant fields. Site validation and manual final submission remain in place.
- Shared dropdown fixes remove synthetic Escape cleanup, prevent implicit native form submissions from dropdown clicks, recognize button dropdowns and their selected labels.
- Added field/navigation action logs (field metadata and route, no answer values) and pause on unexpected page change during workflow filling.
- Cisco authenticated application was not accessible from the inspection browser; live page showed account/sign-in. Workday rollback cause remains unconfirmed until retested with the new build.
- **Supersedes CAPTCHA steps below:** The original fake challenge-only page now pauses because it has no application fields. Remove it manually and press Start / Resume. On ordinary forms with a background CAPTCHA badge, filling must proceed without a CAPTCHA status block.

**Status:** Implemented for manual acceptance. Phase is not signed off.
**Build:** `dist/job-copilot.user.js`, version **0.3.2**.
**Validation:** `npm test`: **55 passed, 0 failed**. `npm run build`: passed. Bundled panel smoke test and deterministic multi-step DOM fixture passed. Live Zen/Firefox + Tampermonkey acceptance remains pending.

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

1. Update Tampermonkey with `dist/job-copilot.user.js`. Confirm panel shows v0.3.2.
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

## Hard gates still awaiting user acceptance

- [ ] Gate 1 — Real listing capture, description and uncertainty display.
- [ ] Gate 2 — Listing-to-application linkage, refresh and next-step continuity.
- [ ] Gate 3 — Correct rejected field, visible bounded repair and verified retry.
- [ ] Gate 4 — Automatic step 1 → step 2 → review.
- [ ] Gate 5 — Review stop with no final submission.
- [ ] Gate 6 — Fake CAPTCHA pause and automatic resume after removal.
- [ ] Gate 7 — Assessment pause with no answer/advance.
- [ ] Gate 8 — Common answer reuse; employer-specific narratives stay isolated.

## Known limits

- Classification is generic and conservative. A form already showing a final Submit control is treated as review by the workflow; **Autofill This Page** can still fill it after boundary checks, with manual submission.
- Slow or ambiguous transitions pause for manual inspection. Unknown cross-origin redirects and unrelated/ambiguous shared endpoints do not automatically attach the latest session. Recent tab-bound redirect recovery requires the same stable application route and unchanged identity query parameters.
- Real CAPTCHA widgets may remain visible after successful completion; if the page does not remove/hide the detected challenge, workflow keeps waiting. No CAPTCHA interactions or solving are performed.
- Boundaries require manual intervention; only CAPTCHA wait automatically resumes. Required uploads remain manual until Phase 5.
- Global memory intentionally covers a small exact list of common profile questions. Phase 6 owns broader memory management/history polish.
- Lever label/answer misalignment remains assigned to Phase 4. No ATS adapter work was added.
- Automated tests use jsdom and mocked GM/OpenRouter responses, not a real browser or live OpenRouter service. Manual acceptance is essential.

No commit or phase tag created. Next step: run the eight hard gates and report failures with URL, screenshot, exact field/action and panel status.
