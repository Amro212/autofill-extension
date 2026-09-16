# Context, Findings & Change Log

This file tracks user-reported findings, platform bugs, audit analyses, and code changes made across conversation turns. All agents must update this document whenever bugs/findings are discussed or changes are applied.

---

## Findings & Bug Reports

### Entry: 2026-09-15 — Applicant profile structured application answers

- **Phase / Environment**: Current Phase 3 refinement; shared applicant profile and unified AI requests, all ATS platforms.
- **User finding / request**: Profile is too generic and currently relies on a large personal-context document. Preserve Resume Context and Applicant Notes; add explicit recurring application answers including sponsorship, gender, disability. Default discovery-source answers to LinkedIn.
- **Audit**: `src/constants.js` exposes only contact/link fields plus two context strings; `src/ui.js` saves those fields explicitly. `src/ai.js` serializes only those basics and currently instructs guessed US authorization, sponsorship, and demographic defaults. New controls must also reach AI payloads and take priority over generic defaults and conflicting context.
- **Research**: Indeed's screener documentation covers authorization, location, commute/relocation, education, experience, languages, licenses, availability, and travel. Greenhouse's standard voluntary questionnaire covers race, gender, veteran status, and disability. These are representative categories, not a frequency ranking.
- **Proposed resolution**: Grouped profile fields for eligibility scoped by country, preferences/availability/compensation, and optional self-identification; preserve existing context and GM storage. Explicit answers take priority; unset sensitive/eligibility fields must not become guessed Yes/No. Source questions use LinkedIn where supported; unavailable options remain reviewable rather than fabricated.
- **Turn changes / next**: Updated this log only. Research and code audit complete; present concrete design for required brainstorming approval before implementation. No runtime changes or commit/tag. Target remains current Phase 3 profile refinement.

### Turn: 2026-09-15 — Approved applicant profile refinement implemented

- **Phase / Environment**: Current Phase 3 profile refinement, userscript v0.3.8; deterministic node:test/jsdom fixtures and mocked OpenRouter transport.
- **Files changed / created**: `src/profile.js`, `src/constants.js`, `src/ui.js`, `src/ai.js`, `tests/profile.test.js`, `tests/panel.test.js`, `docs/plans/2026-09-15-applicant-profile.md`, `package.json`, generated `dist/job-copilot.user.js`, and this log.
- **Changes / rationale**: Added collapsible eligibility, work preferences, compensation, background, and optional self-identification sections. Retained contact fields and both context sections. Shared field schema supplies additive defaults and explicit AI serialization; profile saves preserve existing unknown fields. Eligibility is scoped by work country in AI instructions, with separate current/future sponsorship. Structured answers take precedence in primary, repair, and rewrite requests; removed guessed authorization/sponsorship/demographic prompt defaults.
- **Source / demographic handling**: Source answers are deterministically constrained to LinkedIn, including model omissions and supported LinkedIn Jobs/LinkedIn.com labels. Missing options remain empty, with one bounded combobox search where supported. Common demographic labels use explicit answers or remain blank; supported decline and standard gender/disability labels map only to owned options. More complex question wording continues through AI with explicit grounding rules.
- **Review fixes**: Independent reviewer found rejected LinkedIn aliases and overbroad discovery-prefix matching. Both reproduced by failing tests, corrected, and verified. Additional tests prevent gender-at-birth and demographic-related narrative questions from receiving simplistic overrides.
- **Validation**: Initial seven new integration tests failed for missing functionality; all subsequently passed. Final full suite: 79 tests passed (`node --test --test-reporter=dot tests/*.test.js`, exit 0). `npm run build` succeeded, automatically incrementing 0.3.7 to 0.3.8. `git diff --check` passed. Bundled-panel test verifies labelled controls, save/reload, legacy context preservation, and no page localStorage writes.
- **Limits / next**: No live ATS or live OpenRouter verification this turn; contextual interpretation of eligibility and noncanonical question wording remains model-dependent. Install generated v0.3.8 in Tampermonkey, save explicit profile preferences, and perform manual acceptance. No commit/tag; phase sign-off remains manual.

### Entry: 2026-09-15 — Embedded Greenhouse application reports 0 detected fields (Cross-Origin iframe)

- **Phase / Environment**: Phase 3 / ATS Integration, AlayaCare Careers (`https://alayacare.com/open-positions/?gh_jid=8811313002`). Job Copilot v0.3.5.
- **Evidence / Symptoms**: User screenshot shows an open Greenhouse job application embedded inside `alayacare.com`. Job Copilot floating panel mounts on the top-level page and displays `PAGE FORM FIELDS: 0 detected`, preventing autofill.
- **Audit & Root Cause Analysis**:
  1. AlayaCare embeds Greenhouse via `<div id="grnhse_app">` loading Greenhouse's official embed script `https://boards.greenhouse.io/embed/job_board/js?for=alayacare`.
  2. Greenhouse's embed script dynamically creates an iframe: `<iframe id="grnhse_iframe" src="https://job-boards.greenhouse.io/embed/job_app?for=alayacare&token=8811313002"></iframe>`.
  3. All application form fields (`first_name`, `last_name`, `email`, custom questions, comboboxes) live entirely inside the `job-boards.greenhouse.io` iframe document.
  4. Top-level window (`alayacare.com`) cannot inspect `iframe.contentDocument` due to the browser's Same-Origin Policy.
  5. In [src/main.js](file:///c:/VScode/Autofill-Ext/src/main.js) (lines 28–30):
     ```javascript
     if (window.self !== window.top) {
       return;
     }
     ```
     The userscript explicitly terminates execution when running inside any subframe (`window.self !== window.top`).
  6. Consequently:
     - The instance running in the iframe immediately exits and runs neither scanners, listeners, nor fillers.
     - The instance running in `window.top` mounts the UI panel and scans only the outer `alayacare.com` DOM, finding 0 form fields.
- **Target Phase**: Cross-frame communication & embedded ATS architecture (Phase 4 ATS Hardening or Phase 3 cross-origin frame extension).


### Entry: 2026-09-15 — Continue temporarily disabled during Workday transition

- **Phase / Environment**: Phase 3, Cisco Workday v0.3.3. Screenshot confirms Auto Continue ON. User observed automatic first-to-second-page progression followed by pause.
- **Evidence**: Panel shows `Validation needs manual input: Continue is disabled.`, one recorded step, two remembered answers, but 56 current fields. No transition timing log supplied.
- **Trace / hypothesis**: `inspectValidation` reports the DOM button's disabled state, not the saved setting. Controller waits a fixed 1200 ms after clicking, then routes disabled-only errors into field repair; no field maps to this error, so it permanently pauses. A slower save/render can finish after that pause. Reproducing delayed transitions and temporary pre-navigation disablement before changing code.
- **Target**: Current Phase 3 controller timing; preserve Phase 2 scanners, label extraction and fillers.

### Entry: 2026-09-15 — CoStar Workday reproduces pause with Auto Continue ON

- **Phase / Environment**: Phase 3 acceptance, new CoStar/Matterport Software Engineer I application, v0.3.2. User explicitly confirms Auto Continue ON; manual Save and Continue plus Start / Resume still needed.
- **Evidence**: 06:03:56 received five valid answers; 06:03:57 selected Yes in first questionnaire dropdown then immediately emitted page-change warning on unchanged application URL. Screenshot shows same Application Questions step, four remaining questions unfilled. Settings/language selectors included in scans.
- **Audit / Target**: Reproduce mutable dropdown labels and field order causing signature changes; fix current-phase progression without weakening genuine navigation guards. Full workflow remains unaccepted.

### Entry: 2026-09-15 — Workday rollback resolved; workflow pauses after dropdown selection

- **Phase / Environment**: Phase 3 real Cisco Workday retest, v0.3.2. User confirms no return to resume attachment; manual Save and Continue plus Start / Resume required between steps.
- **Evidence**: Screenshot shows Application Questions, one selected Yes, multiple required dropdowns/date empty; panel paused with `Page changed while filling a field`, 3 steps and 10 remembered answers. Logs show 10 valid AI answers at 05:55:12, first questionnaire dropdown selected Yes at 05:55:13, immediately followed by page-change warning on the same URL path.
- **Assessment**: Rollback fix passed user retest. Full automatic workflow has not passed. Current page signature includes field labels/IDs/types and headings; a same-step dropdown rerender or label change may trip the strict signature guard. This mechanism is suspected from sequence, not conclusively identified without before/after signatures. Scanner also includes unrelated `settingsSelectorButton` and `languageSelectorButton`.
- **Expected behavior**: With Auto Continue enabled and Start / Resume used, valid pages should advance and next step should fill automatically until review/boundary. Autofill This Page and Auto Continue disabled intentionally require manual progression. Supplied logs do not establish the saved Auto Continue setting; previous retest instructions explicitly requested disabling it.
- **Target / Next**: Phase 3 acceptance fixes: distinguish real step transitions from same-step field changes, scope out page-level controls, retest with Auto Continue enabled after fixing the pause. This turn records assessment only; no runtime code changed.

### Entry: 2026-09-15 — Real Workday backward navigation and Greenhouse CAPTCHA false block

- **Phase / Environment**: Phase 3 manual acceptance; user confirms custom simulation works. Real Cisco Workday application, My Information after resume attachment; Greenhouse Canonical job 8142329, userscript v0.3.1.
- **Observed**: Start / Resume returns to resume attachment when AI answers begin applying. Autofill This Page also fails. Greenhouse shows 67 fields but zero steps/answers because CAPTCHA classification blocks the whole form; only background badge is visible in supplied screenshot.
- **User request**: Diagnose and fix backward navigation; remove blanket CAPTCHA blocking of ordinary autofill. This changes the original Phase 3 CAPTCHA gating requirement. No solving or interaction with CAPTCHA requested.
- **Audit**: Screenshots do not prove site anti-automation behavior. Investigating generic dropdown event dispatch, field/control ownership and false classification. Actual Workday DOM/event trace not supplied; live root cause unconfirmed.
- **Target**: Current Phase 3 acceptance fixes; keep broader ATS adapters in Phase 4.
- **Follow-up evidence**: User supplied Cisco job `Software-Engineer_2023758` under `cisco.wd5.myworkdayjobs.com`, route ending `/apply/autofillWithResume`. Supplied logs contain successful local fixture AI calls (roughly 64–66 KB requests), but no Workday field or navigation action. Live read-only inspection reaches Create Account/Sign In, so the authenticated My Information failure could not be reproduced live.
- **Reproduced code defects**: Dropdown cleanup emits bubbling Escape events to unrelated active controls and document navigation handlers; implicit submit dropdown buttons trigger native form submission; scanner skips `type=button` dropdowns. Five new regression cases initially failed and pass after fixes. These are plausible rollback mechanisms, not a confirmed live Workday root cause.

### Entry: 2026-09-14 — Phase 3 workflow audit

- **Context / Phase**: Phase 3 implementation; deterministic jsdom fixtures and bundled panel.
- **Findings / Root causes**: Existing generic verification treated any nonempty text as success, and scanner visibility did not exclude hidden ancestors consistently. New workflow needs stricter checks before navigation. Existing Settings template also interpolated the saved OpenRouter key into an open Shadow DOM input.
- **Resolution / Target**: Phase 3 adds visible-control filtering, exact persistence verification, bounded repair, and a blank replacement-key input that never hydrates the saved secret. Regression tests cover all three cases. Lever-specific label work remains deferred to Phase 4.

### Entry: 2026-09-14 — Lever Answer Misalignment on Open-Ended / Text Fields

- **Context / Phase**: Phase 2 Completion / Pre-Phase 3 Smoke Testing
- **Platforms Tested**:
  - **Ashby**: Working properly without issues.
  - **Lever**: Exhibited shifted answers on open-ended and text inputs.
- **Symptoms / Observed Behavior**:
  - Open-ended narrative and text fields received shifted/swapped answers:
    - *Location field* (`Where do you live? (City and State/Province)`): Filled with candidate bio summary (`I'm a recent Computer Engineering graduate from the University of Guelph...`).
    - *Salary Expectations* (`What is your desired total compensation range for this role?`): Filled with location and work authorization response (`I'm based in the Toronto area and am a Canadian citizen authorized to work in Canada without sponsorship`).
    - *LinkedIn Link* (`LinkedIn Link`): Filled with technical skills overview paragraph (`My strongest technical work spans AI-assisted automation...`).
  - Standard EEO dropdowns (`Gender`, `Race`, `Veteran status`) populated correctly.
- **Audit & Root Cause Analysis**:
  - Lever renders uppercase section headings (e.g., `LOCATION`, `SALARY EXPECTATIONS OPEN RESPONSE`, `LINKEDIN`) in separate DOM elements above the input containers and questions.
  - In [labels.js](file:///c:/VScode/Autofill-Ext/src/fields/labels.js), sibling and parent header search heuristics can capture container headings or misassociate labels when nested within Lever's specific DOM hierarchy.
  - Because `normalizedFields` pass these extracted labels and IDs to `generateAutofillAnswers` in [ai.js](file:///c:/VScode/Autofill-Ext/src/ai.js), ambiguous or improperly delimited label strings cause the LLM to map responses to the wrong `fieldId` in sequence.
- **Resolution Strategy**:
  - **Target Phase**: **Phase 4 — ATS Hardening** ([PHASE_4_ATS_HARDENING.md](file:///c:/VScode/Autofill-Ext/Job_Copilot_Tampermonkey_6_Phase_Kit/PHASE_4_ATS_HARDENING.md), primary ATS #4 Lever).
  - A Lever-specific adapter or DOM label resolver in Phase 4 will handle section heading hierarchies and isolate specific question prompts cleanly from uppercase group headers.
  - No blocker for Phase 2 sign-off or starting Phase 3.

---

## Turn Change Log

### Turn: 2026-09-15 — Single-page autofill pause/stop button & hard-quit task commands

- **User request**: Add a pause/stop button beside the single form page "Autofill This Page" button. Both pause buttons (single-page and multi-step) must act as hard quit task commands WITHOUT tampering with the progress made so far or forgetting memory and fields already filled.
- **Changed**:
  - `src/ui.js`:
    - Added `#jc-pause-autofill-btn` beside `#jc-autofill-btn` in the Page Form Fields card, dynamically enabled when autofill is active with pulsing amber active styling (`.jc-btn-pause-active`).
    - Styled multi-step `#jc-pause-application` with `.jc-btn-pause-active` during running state.
    - Implemented interruptible autofill flow with `autofillSleep` and `cancelAutofillDelay` for instantaneous wake-up and exit on pause.
    - Implemented `stopAutofillFlow()` that increments `autofillGeneration`, resolves active delays, halts field loops immediately, and leaves DOM fields and `fieldResultsCache` completely intact.
    - Added answer recording (`rememberAnswer`, `saveSession`) during single-page autofill so verified fields are safely persisted into session memory and global profile memory without waiting for full completion.
    - Inter-wired both pause buttons so clicking either button immediately halts any running autofill or workflow task.
  - `src/application.js`:
    - Updated `delay` to support immediate cancellation via `cancelDelay`.
    - Made `pause()` cancel pending delays, clear timers, reset `busy = false`, and transition cleanly to `'paused'` while strictly keeping `session.answers`, `session.steps`, `session.history`, and all DOM inputs intact.
  - `src/memory.js`:
    - Made `rememberAnswer` safely tolerate null/undefined `session` objects, ensuring global memory writes for common fields work seamlessly even without an active application session.
  - `tests/application.test.js` & `tests/panel.test.js`:
    - Added regression test asserting that Pause acts as a hard quit during field filling, leaves DOM values in place, and preserves session memory and step answers.
    - Asserted presence and mount of `#jc-pause-autofill-btn` in the Shadow DOM UI panel.
- **Tests / Build**:
  - Full test suite passed (67/67 tests, 0 failures).
  - Built `dist/job-copilot.user.js` successfully (v0.3.7).
- **Status / Next**: Ready for testing both single-page and multi-step pause flows in browser.

### Turn: 2026-09-15 — Multi-step application UI polish & status redesign

- **User request**: Polish Phase 3 UI: add a clear progress bar and "done" badge/pill when complete, remove listing URL link, show only useful metrics for the applicant (steps completed, fields answered), rename "Phase 3 · Application Workflow" to clearly state it's for multi-step applications, enhance overall visual aesthetic.
- **Changed**:
  - `src/ui.js`:
    - Renamed section to "Multi-Step Application".
    - Added color-coded status badges: `✓ Done — Ready for Review` / `✓ Submitted` (emerald green badge with subtle glow), `● Running` (pulsing sky blue), `⏸ Paused` / `⏸ CAPTCHA` / `⏸ Manual Step Required` (amber warning), and `Not Started` (slate idle).
    - Added left-accent border to `.jc-workflow-card` that transitions dynamically based on state (`wf-running`, `wf-paused`, `wf-done`).
    - Added a step progress bar (`.jc-wf-step-bar`) with pulse animation during execution and full emerald green bar on completion.
    - Replaced raw session ID and technical internals with applicant-centric metrics: "X steps completed" and "Y fields answered".
    - Removed raw listing URL to reduce visual noise.
    - Improved formatting for status reason and error messages.
- **Tests / Build**:
  - Full test suite passed (66/66 tests, 0 failures).
  - Built `dist/job-copilot.user.js` successfully (v0.3.6).
- **Status / Next**: Ready for user testing on multi-step flows.

### Turn: 2026-09-15 — Systematic debugging of embedded Greenhouse cross-origin iframe (0 detected fields)

- **User request**: Investigate edge case on `https://alayacare.com/open-positions/?gh_jid=8811313002` where Job Copilot reports "0 detected" fields on an apparent Greenhouse embedded application. Apply `/systematic-debugging`.
- **Investigation / Audit**:
  1. Inspected live page DOM and network resources. AlayaCare mounts Greenhouse via `<div id="grnhse_app">` using Greenhouse's official embed script `https://boards.greenhouse.io/embed/job_board/js?for=alayacare`.
  2. The embed script inserts `<iframe id="grnhse_iframe" src="https://job-boards.greenhouse.io/embed/job_app?for=alayacare&token=8811313002">`.
  3. All 17 form fields (name, email, location, phone, custom questions) are located inside `job-boards.greenhouse.io`, completely isolated from `alayacare.com` by the browser Same-Origin Policy.
  4. Verified via JSDOM simulation of the Greenhouse embed document that `scanFormFields` accurately detects all 17 fields with proper labels and types when executed in the iframe's context.
  5. Isolated root cause to [src/main.js](file:///c:/VScode/Autofill-Ext/src/main.js) lines 28–30:
     ```javascript
     if (window.self !== window.top) {
       return;
     }
     ```
     This check was originally added to satisfy Rule 7 (Single UI Host) to avoid mounting floating UI panels inside ads or hidden frames. However, by exiting immediately, the userscript completely deactivates inside any child frame. As a result, no scanner, listener, or filler runs in the Greenhouse iframe, while the top-level UI on `alayacare.com` cannot reach inside the cross-origin iframe.
- **Next Steps & Options**: Propose architectural options (cross-frame `postMessage` protocol vs. iframe detection with direct-link detachment) to the user for discussion.


### Turn: 2026-09-15 — Ignore obsolete packages directory

- **User request**: Safely ignore the untracked `packages/` directory if safe.
- **Audit**: Verified that `packages/` contains only legacy build outputs (`dist/`) and `node_modules/` left over from the earlier monorepo architecture prior to commit `97d5bd8`. There are no tracked files or source files in `packages/`, and no code in the active userscript codebase references it.
- **Changed**: Added `packages/` to `.gitignore`.
- **Status / Next**: All 66 tests pass. The local `packages/` folder can also be deleted if desired to free up disk space.

### Turn: 2026-09-15 — Human narrative voice in AI prompts

- **User request**: Ground autofill/rewrite tone as complete human writing. No em dashes. Distill [humanizer skill](https://github.com/blader/humanizer/blob/main/SKILL.md) essentials into the system prompt instead of pasting the whole skill.
- **Changed**: `src/ai.js` adds a shared `NARRATIVE_VOICE_RULES` block used by unified fill and rewrite prompts. Replaced "polished, professional, compelling" with natural first-person instructions. Hard bans cover em/en dashes, not-X-but-Y staging, dramatic closers, stock AI/sales wording, forced triads, and chatbot wrappers. Free-text answers and rewrite output also strip leftover em/en dashes; option-bound fields stay exact.
- **Tests**: `tests/autofill.test.js` asserts both prompts include the voice rules and that dash stripping does not rewrite combobox labels. Full suite 66/66. Build v0.3.5.
- **Next**: Reload the built userscript and spot-check a narrative field. Live OpenRouter tone cannot be certified from fixtures alone.

### Turn: 2026-09-15 — Bounded navigation readiness, v0.3.4

- **Investigation**: Read explicitly requested systematic-debugging skill and condition-based-waiting guide. Traced screenshot error from DOM disabled state through `inspectValidation` into `repair`, where no field maps to it and workflow pauses. Reproduced slow navigation and delayed button enablement with failing tests; actual live timing remains inferred from screenshot/user sequence.
- **Changed**: `src/application.js` replaces fixed post-click delay with a bounded readiness wait, separately handles pre-click disabled buttons, detects stable populated next steps and `aria-busy`, preserves cancellation/boundary/review stops, logs wait outcomes, and keeps disabled-only errors out of AI repair. No Phase 2 scanner, label, dropdown or filler changes this turn.
- **Tests / outputs**: `tests/application.test.js` adds five timing/lifecycle regressions. 64 tests pass; build v0.3.4 succeeds. Updated package/lock versions, `PHASE_3_REPORT.md` and generated userscript.
- **Next**: User updates/reloads Workday and starts with Auto Continue ON. Expect visible waiting status during saves, followed by automatic next-step filling. If timeout persists, inspect Navigation wait logs and the page's own validation. Phase 3 acceptance remains pending; no commit/tag.

### Turn: 2026-09-15 — Preserve Phase 2 compatibility without repeated user retesting

- **User requirement**: Phase 3/Workday fixes must preserve previously working single-page Lever, Ashby and Greenhouse behavior. User does not want to repeatedly retest Phase 2 applications after each change.
- **Execution constraint**: Protect shared scanner, label, dropdown, filler and verification changes with targeted regression tests for existing behavior, in addition to new Workday reproductions. Prefer narrow changes; do not claim complete live-site compatibility from synthetic test results alone.
- **Evidence / limitation**: v0.3.3 passed all 59 automated tests, including existing Phase 2 dropdown ownership, selection, search and Greenhouse-style cases. This is regression evidence, not a live acceptance pass for every ATS or complete coverage of all label/scanner layouts.
- **Changes this turn**: Context documentation only; no runtime changes or build required.

### Turn: 2026-09-15 — Workday label stability / automatic progression, v0.3.3

- **Root cause reproduced**: Button `aria-labelledby="question buttonId"` incorporates selected text into question identity. Selecting Yes changes the page signature and fires the exact same-step pause seen in both user logs. Actual live DOM not captured, but controlled reproduction matches the observed sequence.
- **Modified**: `src/fields/labels.js` excludes self/selected-value references and interactive descendants from referenced question text; `src/fields/scanner.js` excludes page chrome controls; `src/navigation.js` includes H3 step headings. Updated `tests/application.test.js`, `PHASE_3_REPORT.md`, package metadata/lock and generated userscript v0.3.3.
- **Verification**: Four new regressions failed before changes and passed afterward; full suite 59/59 passes; build succeeds. Workflow regression advances across same-URL steps automatically and stops at review. Existing true-navigation interruption tests remain passing.
- **Next**: Update/reload Tampermonkey, Auto Continue ON, Start / Resume once. Confirm remaining questions fill and next step begins automatically. Phase 3 manual acceptance still pending; no commit/tag.

### Turn: 2026-09-15 — Real-site acceptance fixes, v0.3.2

- **Modified**: `src/pageClassifier.js` removes blanket CAPTCHA blocking per user request; `src/fields/scanner.js` excludes challenge/response controls and supports button dropdowns; `src/fields/combobox.js` removes synthetic Escape cleanup, prevents implicit submit defaults, reads button selections; `src/fields/fillers.js` uses safe dropdown option clicks and logs field metadata; `src/application.js` logs navigation and pauses after unexpected step changes during filling; `src/ui.js` checks URL changes during one-page autofill.
- **Tests / documentation**: Added regression cases in `tests/autofill.test.js` and `tests/application.test.js`; updated `PHASE_3_REPORT.md`, package version/lock and generated userscript.
- **Verified**: 55 tests pass, build succeeds, v0.3.2 produced. Five initial regression failures reproduced the shared dropdown/CAPTCHA defects before changes. Live Cisco page was inspected read-only but the My Information step needs the user's authenticated session; actual rollback not yet confirmed fixed.
- **Next**: User updates Tampermonkey and retries Cisco My Information with Auto Continue off first; if rollback persists, collect new Field action / Navigation action logs. Test Greenhouse ordinary autofill with background CAPTCHA badge. No commit/tag.

### Turn: 2026-09-14 — Phase 3 application engine implementation

- **Phase status**: Phase 3 implemented for manual acceptance; all eight user hard gates remain pending. No commit/tag.
- **Created**: `src/jobs.js`, `src/sessions.js`, `src/pageClassifier.js`, `src/validation.js`, `src/navigation.js`, `src/memory.js`, `src/application.js`; `fixtures/phase3-application-fixture.html`; `tests/application.test.js`, `tests/panel.test.js`; `docs/plans/2026-09-14-phase-3-application-engine.md`; `PHASE_3_REPORT.md`.
- **Modified**: `src/ui.js` for workflow controls/status, boundary checks and saved-key protection; `src/ai.js` for job and repair context; `src/constants.js` and `src/storage.js` for GM keys and reset; `build.js` for GM tab grants; `tests/autofill.test.js` for prompt context/security; package metadata/lock version; generated `dist/job-copilot.user.js` v0.3.1 (ignored build output).
- **Rationale**: Separate bounded workflow controller reuses Phase 2 field primitives. Durable sessions and scoped memory retain context without guessing across unrelated jobs. Native/ARIA/visible validation and exact persistence verification guard navigation.
- **Review fixes**: Failed primary requests no longer mark a page complete before answers arrive; Resume retries within persisted bounds. Recent tab-bound POST redirects recover within a stable same-application path; general fallback remains exact-URL matched.
- **Verification**: 50 automated tests passed; esbuild bundle succeeded; bundled Shadow DOM panel smoke test passed. No live browser/OpenRouter acceptance claimed.
- **Preserved existing user changes**: `AGENTS.md`, deleted Phase 1/2 reports and prior findings. Lever-specific work remains Phase 4.
- **Next steps**: Install v0.3.1 in Tampermonkey, run fixture and real-listing hard gates in `PHASE_3_REPORT.md`, resolve any failures within Phase 3, then await manual acceptance before commit/tag.

### Turn: 2026-09-14 — Established Findings Logging & AGENTS.md Protocol
- **Files Modified / Created**:
  - [AGENTS.md](file:///c:/VScode/Autofill-Ext/AGENTS.md) [MODIFY]: Added mandatory agent rule to log user findings, bugs, audit context, and turn changes into `CONTEXT_AND_FINDINGS.md`.
  - [CONTEXT_AND_FINDINGS.md](file:///c:/VScode/Autofill-Ext/CONTEXT_AND_FINDINGS.md) [NEW]: Initialized context log documenting Ashby (success) and Lever (answer shifting) findings, root cause audit, and future Phase 4 resolution target.
- **Next Steps**:
  - Tag Phase 2 (`phase-2-generic-autofill-pass`).
  - Begin Phase 3 (Application Engine: session continuity, multi-page flows, validation repair, auto-continue).

### Turn: 2026-09-14 — Transferred Full Global Agent Rules to AGENTS.md
- **Files Modified / Created**:
  - [AGENTS.md](file:///c:/VScode/Autofill-Ext/AGENTS.md) [MODIFY]: Copied all 17 global rules from `GLOBAL_AGENT_RULES.md` into Section 2 with matching bold label and descriptive formatting.
  - [CONTEXT_AND_FINDINGS.md](file:///c:/VScode/Autofill-Ext/CONTEXT_AND_FINDINGS.md) [MODIFY]: Updated turn log.
- **Next Steps**:
  - Ready for Phase 2 tag and Phase 3 planning.
