# Workday false page-change investigation

Date: 2026-09-15. Scope: Phase 3, v0.3.8. Requested deliverable: investigation and surgical fix proposal.

Implementation update (2026-09-16): user approved the proposal and supplied logs confirming the English language selection immediately precedes the warning at an unchanged logged Workday path. The exact old-signature component remains unknown. v0.3.9 implements the correction; 103 tests pass and the userscript builds. `docs/diagnostics/workday-page-change.mjs` now runs maintained acceptance regressions instead of asserting the old bad behavior. The investigation/reproduction evidence below describes v0.3.8. See PHASE_3_REPORT.md for implementation and retest instructions.

## Conclusion and confidence

Confirmed design defect: `pageSignature` conflates application-step identity with a mutable form snapshot. It contains the full URL, every visible h1/h2/h3/aria-current-step text, and the ordered list of scanned field IDs, labels and types. The application scanner excludes hidden, disabled and readonly fields. A validation heading, conditional field, temporary disabled state, changing accessible label, reordered controls or regenerated ID can change this signature without navigation.

The exact mutation in the user's authenticated RBC Workday run remains unobserved. Screenshots establish the pause and unfinished fields, not DOM attributes or event history. Do not claim the visible Errors Found title is an h3, or that a particular dropdown caused this incident, without live evidence. The source-level defect and synthetic reproductions are confirmed independently.

## Evidence from attachments

- My Information: 18 detected fields; successful job capture; partial filling; same pause on Resume. Required referral/address/postal inputs remain empty. City and province are populated in the second image.
- Subsequent page: 72 detected fields; language selected; proficiency controls empty; same pause after manual advancement.
- Displayed completed-step count rises from 1 to 2 to 3. This is consistent with signature churn; the counter itself is not evidence of successful navigation.
- Validation messages could arise from field validation or a submission attempt. Screenshots cannot distinguish either. The observed pause does not prove that Continue was never clicked earlier in the session.

## Current execution path

1. Capture creates a session, without advancing the site. Start / Resume activates it and runs `tick`. MutationObserver (300 ms debounce) and a 1500 ms timer schedule subsequent ticks; busy/inactive checks prevent ordinary overlapping work and prevent paused sessions from resuming themselves.
2. `tick` scans fields and uses the complete signature as the key in `session.steps`. A new signature immediately appends a history record, before filling or navigation succeeds.
3. One primary request supplies unanswered fields, with verified memory reused where available. Options are harvested first. Signature checks run after harvesting and AI response; any mismatch discards the response. Some mismatch paths return without setting a pause reason.
4. `step.primary` becomes true before applying answers. Each field is relocated by ID + label + type. The controller checks the complete signature before each action and after filling plus a default 180 ms delay. Any post-action mismatch sets the exact reported pause and returns before verifying the just-filled field or filling later fields.
5. Only after filling does validation/repair run. Auto Continue must be enabled, validation clear, and exactly one supported Continue control present. The exact label Save and Continue is already supported.
6. A disabled control gets a bounded readiness wait. An enabled control is clicked; the controller waits up to 10 seconds, requiring up to 200 ms of stable signature and no visible aria-busy. Any changed signature with fields is treated as the next step, before same-signature validation handling. Thus validation-driven signature changes can also masquerade as navigation.
7. On Resume, a changed signature creates fresh primary/repair/click state; unchanged signatures reuse stored answers for empty fields. Limits are two primary attempts, two repairs and three clicks per signature; thirty session navigation attempts and forty passes per tick remain global safeguards. Mutable keys weaken per-step limits.
8. `ui.js` calls `session.history.length` “steps completed.” These are observed snapshots, not confirmed completions. `session.transitions` counts click attempts and is also unsuitable as a completed-step counter.

## Recent-change audit

The earlier v0.3.3 fix handles one selected-value leak through aria-labelledby and adds h3 detection. Its focused tests pass. It does not make the overall signature stable. The subsequent navigation-readiness change still uses the same signature. Latest profile/UI changes do not modify this signature algorithm. Longer delays alone do not resolve durable same-step mutations.

## Reproduction and validation

Run `node docs/diagnostics/workday-page-change.mjs` from the repository root. This is a diagnostic asserting existing bad behavior, not a regression test that should remain unchanged after fixing it.

Confirmed:

- Adding a validation heading, adding a conditional field, disabling a field, or changing its accessible label changes the signature at the same URL and step heading.
- Heading mutation during filling causes the exact reported pause, leaves the next field blank and produces zero Continue clicks.
- A second attempt after a simulated site reset and another heading mutation produces two history records and two primary requests for one actual page.
- Heading-only change on Continue creates another history record and another Continue click without leaving the page.

`npm test`: 79 passed, 0 failed. No live RBC execution or OpenRouter call performed. Existing tests demonstrate previously supported cases, not coverage of these newly reproduced mutations.

## Proposed surgical patch

1. **Separate identity from snapshot in `navigation.js`.** Introduce a structured step observation: application URL context, an unambiguous active-step marker (prefer aria-current=step), and a scoped stable step heading. Record fields separately for reconciliation. Do not include every section/error heading or mutable field roster in the step key. Do not reduce identity to URL alone: existing same-URL step navigation must work. Use confirmed Workday DOM evidence before adding site-specific selectors. Where markers are absent, classify replacement of the form/question set conservatively; uncertain changes require a bounded settling check and explicit pause, not silent continuation.
2. **Use that distinction consistently in `application.js`.** Apply the same observer/comparison policy during option harvesting, AI response handling, before/after field actions, repair, and navigation waiting. A confirmed step change invalidates stale answers. A confirmed same-step mutation settles and rescans. Preserve existing answer plans and retry counters for that step. Relocate only unambiguous matching questions; never map changed IDs by position, and never carry an answer across a genuinely changed question merely because its ID was reused.
3. **Reconcile dynamic fields within existing bounds.** Resume unfinished compatible answers. Newly revealed unanswered fields get a bounded late-field request within the same step, not a fresh primary request for the whole page. If field semantics/options changed, discard incompatible answers. Hidden/temporarily disabled controls must not create new steps; recheck readiness before allowing navigation. Stop with a useful reason when changes cannot be resolved within the budget.
4. **Require actual transition evidence after Continue.** Same-step validation returns to repair. Loading indicators, heading errors, field enablement and menu changes must not satisfy successful navigation. Preserve existing disabled-button waits, same-URL next-step support, true-navigation interruption, manual boundaries and final-review stop.
5. **Correct accounting and diagnostics.** Count completed steps only after verified advancement; display observed steps honestly if that is the chosen metric instead. Log a compact change classification (URL/step marker/heading changed, field counts and structural deltas, triggering field ID, navigation-click state), without raw answers, resume text or API keys. Current warning only logs the acted-on ID/path, so it cannot identify the mismatching component. Version new session identity data; import legacy step state only when identity and question compatibility are unambiguous, otherwise explicitly require recapture rather than silently combining historical signatures.

Primary runtime touch points: `src/navigation.js`, `src/application.js`; a small `src/ui.js` accounting correction and explicit persisted-session compatibility handling. Keep shared Phase 2 scanner/label/filler behavior intact unless an independent reproduction proves a separate defect there.

## Acceptance cases for implementation

- Same-step validation headings appear/disappear: finish remaining compatible answers without false pause or extra primary request.
- Dependent fields appear/disappear; temporary disabled states settle; same semantic controls rerender. Keep one step and preserve retry budgets; fill newly revealed fields within bounds.
- Changed question with reused ID: reject stale answer. Ambiguous replacement: pause explicitly.
- Resume after partial filling: continue unfinished answers, preserve completed-step count, avoid replaying a full primary request.
- Validation after Continue: repair within the same step, do not count advancement or reset budgets.
- Actual URL transition and actual same-URL step transition: detect correctly; old AI responses cannot write into the new step. Include identical field IDs on different steps and markerless forms.
- Existing late-load, disabled-button, cancellation, boundary, final-review and Phase 2 dropdown tests remain passing. Run the complete suite and build `dist/job-copilot.user.js` after implementation.
- One authenticated Workday retest with the compact diagnostic distinguishes remaining scanner/profile omissions from interrupted filling. Blank source/address/proficiency fields are not individually proven to be caused solely by this signature defect.

## Changes in this investigation

Added this report and the deterministic diagnostic; updated CONTEXT_AND_FINDINGS.md. No runtime patch, version bump, commit or tag. Implementation remains the next step after this requested proposal.
