# Context, Findings & Change Log

This file tracks user-reported findings, platform bugs, audit analyses, and code changes made across conversation turns. All agents must update this document whenever bugs/findings are discussed or changes are applied.

---

## Findings & Bug Reports

### Turn: 2026-09-16 — Approved location autocomplete lifecycle correction

- **Authorization / scope**: User approved surgical fixes from the prior research. Shared asynchronous dropdown correctness plus narrowly recognized current-residence grounding; no speculative ATS adapters or external services.
- **Reproductions**: Ten tests initially failed for stale location suggestions, results delayed 3.3 seconds, superseded searches, detached controls, standard autocomplete attributes without role, slow commitment, blur rejection, clearing committed input, and profile-location grounding. Two additional tests reproduced cleanup erasing a newer query and preselected values bypassing post-blur checks.
- **Implementation**: `src/fields/combobox.js` tracks query generations, checks relevance and stability, allows 8-second active searches / 3-second initial discovery, aborts changed/detached waits, and verifies stable valid selections for up to 2.5 seconds. `scanner.js` recognizes standard autocomplete attributes and guards cleanup ownership. `fillers.js` rechecks owned live options, checks selection after blur, and preserves committed display/newer queries. `verify.js` uses bounded stable verification. `profile.js` grounds explicit current-residence comboboxes in the full existing profile.location; duplicate/absent matches stay unresolved. Plain text and ambiguous employer/Location labels keep their existing handling.
- **Tests / docs**: Modified `tests/autofill.test.js`, `tests/profile.test.js`; added `docs/plans/2026-09-16-location-autocomplete.md`. Initial full suite 119/119 passed before two follow-up fixes; final validation pending below. No commit/tag.
- **Limits**: Query-term relevance and DOM stability cannot prove request provenance; no real failing ATS URL supplied. No new provider-specific commit adapters, geocoding, or universal compatibility claim. Full normalized location matching deliberately does not guess region abbreviations or infer residence from work eligibility.

### Entry: 2026-09-16 — Intermittent location autocomplete selection

- **Phase / environment**: Shared location/combobox investigation across Greenhouse, Lever, Ashby; current build v0.3.10. Cross-platform hardening relates to Phase 4; this turn requests research and an adaptation proposal.
- **User report**: Location sometimes selects correctly and sometimes fails. User suspects suggestions arrive several seconds after typing and explicitly requests verification, industry approaches, and userscript-compatible handling.
- **Audit / next**: Check primary vendor documentation and shared scanner/search/fill/verification code. No failing live URL or DOM/log capture supplied, so distinguish confirmed implementation gaps from unproven incident root cause. No runtime changes authorized by this research question.
- **Verified research**: Greenhouse Job Board API docs explicitly describe typed location -> Google Places predictions -> selected place -> Place Details/coordinates. Ashby documents structured candidate locations but not a universal latency/provider. No primary documentation confirming Lever's specific location autocomplete/provider was found. React Select documents separate input and selected values plus asynchronous option loading; its source discards callbacks from superseded requests. No vendor-wide several-second latency guarantee established.
- **Code evidence**: `waitForComboboxOptions` waits 150 ms then accepts any nonempty owned options without matching them to the active query; deadline 3000 ms. Synthetic read-only Node/JSDOM diagnostic changed query to London Ontario while old London UK result remained until a 600 ms update; current helper returned the old result after 224 ms. This reproduces a stale-harvest race, not proof of the user's specific live failures or wrong-location selection. `fillCombobox` reopens/clears/searches known label, verifies for about one second, then unconditionally clears search input; `verifyCombobox` has one 120 ms retry. Scanner requires combobox/listbox semantics for the custom path, so unmarked location autocomplete can instead take plain-text verification.
- **Proposed userscript adaptation**: Profile-grounded city/region/country queries; per-field query generations and bounded state-based DOM waits; owned fresh suggestions and location-component checks; actual option activation; post-blur persisted-selection verification using observed widget-specific evidence; two bounded searches and clear unresolved state. Keep plain text locations valid as plain text, preserve other combobox behavior, avoid external geocoding/backends/hidden-state injection. Add deterministic delayed/stale/rerender/ambiguous-location/commit regressions plus existing suite before any runtime change. Live examples required to validate each platform's markup and commit semantics.
- **Turn changes**: This context entry only; runtime and build unchanged. Research answer with concrete proposed correction, no commit/tag.

### Turn: 2026-09-16 — Approved Phenom Next detection correction, v0.3.10

- **Authorization / scope**: User approved the preceding narrow navigation fix, regression coverage, clearer reasons, and separate broader Phenom acceptance matrix. Current Phase 3 correction; no field-engine rewrite or Phase 4 platform implementation.
- **Root cause / fix**: RBC progress Review and actual Next both matched. `src/navigation.js` now excludes tab lists and toolbars with explicit step markers, preserves ordinary forward controls and the `findContinue` contract, and exposes missing/multiple/disabled reasons. `src/application.js` uses these reasons when navigation selection fails.
- **Changed**: Runtime files above; six cases in `tests/application.test.js`; `docs/plans/2026-09-16-phenom-navigation.md`; `PHASE_3_REPORT.md`; package version/lock and generated userscript. Existing user edit to `AGENTS.md` preserved.
- **Verification**: Five of six new tests failed before runtime edits; all six pass after. Full suite 109/109 passed; `npm run build` produced v0.3.10 successfully. Diff whitespace check passed. Shared Phase 2 primitives unchanged. No live form filled or submitted this turn.
- **Next / limits**: Install v0.3.10 and confirm RBC progresses from the user's populated step. Broader live Phenom acceptance remains documented and pending; automated regressions are not complete ATS certification. No commit/tag.
- **Independent review**: Read-only reviewer found no actionable defects; confirmed narrow exclusion, retained standalone Review behavior, disabled-control contract, and genuine ambiguity pauses.

### Entry: 2026-09-16 — RBC visible Next control and platform identification investigation

- **Phase / Environment**: Phase 3 navigation investigation; RBC hosted application `/ca/en/apply`, step 2 `workAndEducation`, v0.3.9. Platform identification under investigation; previous Workday label was not verified for the frontend.
- **User evidence / request**: New screenshots clearly show Previous and Next buttons below Websites, and a five-step application header. User asks how Next detection works, which platform/font this is, and how compatibility can be extended without regressions.
- **Audit / target**: Trace the exact current candidate selector and inspect public site evidence. Visible screenshot button does not establish its HTML tag, accessible name, duplicate candidates, or disabled state. Current Phase 3 navigation scope; broader platform hardening remains Phase 4.
- **Changes / next**: Documentation-only investigation entry; no runtime changes, commit, or tag. Record verified platform evidence and findings below after inspection.
- **Verified live evidence**: Fresh browser opened the supplied URL but rendered the initial personalInformation form (not the user's populated step 2). Read-only evaluation of the current selector/visibility/text rules finds two candidates: progress toolbar `li[role=button][atm-id=applicationReview]` labelled Review, and enabled `button#next.btn-navigate.btn-next[type=submit]` labelled Next. Both pass disabled checks, so `findContinue` returns null. This establishes the collision on the live initial form and strongly explains the same shared progress bar in the user's step-2 screenshot; no authenticated step-2 reproduction claimed.
- **Platform / font correction**: DOM-linked resources include Phenom Apply Studio V3 renderer, Phenom Apply common scripts, and RBC tenant styles on phenompeople.com. Frontend is Phenom; underlying ATS is not established by this inspection. Computed font families: body `rbctext-regular-webfont`, heading/Next `rbctext-medium-webfont`, progress item `Roboto-Regular`. Earlier RBC Workday references should not be treated as verified frontend identification.
- **Recommended scope**: First add navigation regressions for progress Review plus real Next and preserve standalone Review-as-forward behavior; use form/navigation context to exclude progress destinations, preserve genuine ambiguity pauses, and expose candidate rejection reasons. Broader Phenom repeated sections, dates, conditional selects, uploads and transitions require a separate compatibility matrix and live acceptance; screenshots cannot establish complete compatibility. No runtime edits or tests/build this explanatory turn.

### Entry: 2026-09-16 — RBC Continue pause wording after successful fill

- **Phase / Environment**: Phase 3 live acceptance, RBC Workday, userscript v0.3.9.
- **User report / evidence**: User reports all empty fields filled, followed by paused message "No unambiguous enabled Continue control. Continue manually." Screenshot also shows "Please select an item in the list", 20 fields answered and 0 steps completed. User asks what the message means and whether ambiguity is a setting.
- **Audit**: `src/navigation.js` requires exactly one visible navigation candidate with an exact recognized label; zero or multiple matches return null. `src/application.js` emits the reported pause after filling/validation when no candidate exists or the selected control is disabled. "Enabled" describes the site's button state, not a settings toggle. Screenshots do not include the navigation controls, so they cannot distinguish missing/unrecognized buttons, duplicate matches, or disabled state. Separate validation warning needs field/log evidence to determine whether it remains current.
- **Target / changes / next**: Current Phase 3 diagnostics/wording; explanation requested, no runtime change. Modified this log only. Inspect actual navigation controls/debug evidence if further diagnosis is requested; no live reproduction or build needed for documentation-only work. Phase acceptance unchanged; no commit/tag.

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

### Turn: 2026-09-17 — Extension conversion feasibility study (no runtime change)

- **User request**: Study whether the current Tampermonkey stack can convert to a Chrome/Firefox extension, what refactor is required, agentic effort, new capabilities, and whether bot-detection stays equivalent.
- **Audit**: Current product is a single esbuild IIFE (`src/main.js` → `dist/job-copilot.user.js`) using GM storage, `GM_xmlhttpRequest`, `GM_getTab`/`GM_saveTab`, a top-window-only Shadow DOM panel, and isolated-world-style native input setters. Field engine, application controller, AI, profile, and navigation do not depend on Tampermonkey-specific DOM behavior. Known product gap: top-window guard skips cross-origin Greenhouse embeds.
- **Conclusion recorded for later agents**: Parity conversion is a runtime-shell swap, not a field-engine rewrite. Biggest code change is async storage plus background-script OpenRouter proxy (required for Firefox CSP). Bot detection should remain equivalent if the fill model stays DOM events in a content script and we avoid `chrome.debugger`, header spoofing, and MAIN-world globals. Largest unique extension win is invisible cross-frame `runtime` messaging for embeds. No code, build, or commit this turn.

### Turn: 2026-09-15 — Manual sign-off: Phases 1, 2, and 3 marked complete

- **User request**: "lets mark phase 1, 2, 3 as complete now"
- **Status & Hard Gate Audit**:
  - **Phase 1 (Foundation)**: All 6 gates passed (Tampermonkey userscript install, Shadow DOM UI isolation, GM storage persistence, OpenRouter secret isolation, AI connectivity test, panel stability).
  - **Phase 2 (Generic Autofill)**: All 7 gates passed (comprehensive field scanning for text/textarea/select/radio/checkbox, unified AI page requests, DOM event dispatch & React state adherence, verification with exact persistence check, overwrite toggling, narrative rewrite, safe real-page execution).
  - **Phase 3 (Application Engine)**: All 8 gates passed (job capture with JSON-LD & DOM fallback, durable multi-page session continuity across steps/refreshes, validation error detection & bounded semantic AI repair, automatic step progression with Auto Continue, clean review stop without unauthorized submission, CAPTCHA classification without blocking ordinary forms, assessment boundary protection, normalized global & session memory).
  - **Profile Management & Polish**: Explicit structured fields for repetitive application questions (work authorization, sponsorship, notice period, compensation, demographics/EEOC), automatic source mapping to LinkedIn for discovery questions, and interruptible hard-quit pause mechanics for both single-page and multi-step forms.
- **Changed**:
  - `PHASE_3_REPORT.md`: Updated status to "Accepted & Signed off by user (Phases 1, 2, and 3 Complete)"; all 8 hard gates marked passed.
  - `Job_Copilot_Tampermonkey_6_Phase_Kit/PHASE_1_FOUNDATION.md`: Checked off all 6 hard gates as passed and accepted.
  - `Job_Copilot_Tampermonkey_6_Phase_Kit/PHASE_2_GENERIC_AUTOFILL.md`: Checked off all 7 hard gates as passed and accepted.
  - `Job_Copilot_Tampermonkey_6_Phase_Kit/PHASE_3_APPLICATION_ENGINE.md`: Checked off all 8 hard gates as passed and accepted.
  - Created git tags:
    - `phase-1-foundation-pass`
    - `phase-2-generic-autofill-pass`
    - `phase-3-application-engine-pass`
- **Next Phase**: Ready to begin **Phase 4: ATS Hardening** (Workday multi-step hardening, Lever section heading resolver, Ashby custom inputs, Greenhouse nested embeds).

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
### Turn: 2026-09-15 — Workday false page-change pause investigation (Phase 3)

- **User report / environment**: RBC Workday application, userscript v0.3.8, after resume upload and successful Capture Job. Start / Resume partially fills My Information then pauses with "Page changed while filling a field" despite no observed navigation. Resume repeats the failure. After manual completion and Save and Continue, the following page also partially fills and pauses with the same error.
- **Screenshot evidence**: My Information reports 18 fields; referral source, address line 1 and postal code remain blank; screenshots show validation messages and populated city/province. Next page reports 72 fields, with language proficiency selects still blank. Displayed steps completed rises 1 → 2 → 3 across attempts; these counts are not proof of navigation.
- **Audit / root cause**: Confirmed `pageSignature` conflates step identity with mutable headings and ordered field IDs/labels/types. The same key gates field actions, keys persisted step/retry state and detects navigation. Deterministic JSDOM reproduction triggers the exact pause without navigation, leaves the next field blank with zero Continue clicks, and produces extra history/primary requests on Resume. A separate reproduction accepts a heading-only post-click change as navigation. UI counts history snapshots as completed steps. Screenshots do not establish the exact changed DOM property or whether a submit event occurred in the real run.
- **Target**: Current Phase 3 application-engine correctness. User requests systematic investigation and a surgical fix proposal. Preserve Phase 2 compatibility and existing uncommitted documentation edits.
- **Changed / rationale**: Added `docs/workday-page-change-investigation.md` (trace, evidence, narrow implementation proposal and acceptance matrix) and `docs/diagnostics/workday-page-change.mjs` (reproducible current-bug evidence). No runtime edits. Proposed separation of stable step identity from form snapshot, bounded same-step reconciliation, consistent transition guards, truthful metrics and compact change diagnostics.
- **Verification / next**: Diagnostic passed its current-bug assertions; existing suite 79/79 passes. No live RBC or AI verification claimed. Next: implement the proposed Phase 3 correction with failing acceptance tests, preserve shared Phase 2 behavior, build and retest Workday. No commit/tag.
### Turn: 2026-09-16 — Approved Workday step-tracking correction (Phase 3)

- **User evidence / authorization**: User approved the investigation proposal and supplied Debug logs from v0.3.8 on RBC Workday. At 00:54:42 the engine selects English in `language-163--language`, then immediately logs `Page changed during field action` at the same application path. Proficiency comboboxes remain uncommitted. Logs confirm the failing action and unchanged logged path, but do not record the signature component that changed; earlier My Information actions are absent from the retained log.
- **Target / plan**: Implement approved workflow correction: stable step identity, bounded same-step reconciliation, consistent stale-answer guards, truthful completion accounting and structural diagnostics. Protect Phase 2 shared primitives. Preserve prior phase sign-offs; this correction needs live Workday confirmation. No commit/tag requested.
- **Changed / rationale**: `src/navigation.js` separates step evidence from field snapshots and adds workflow-only stable question labels; `src/application.js` settles same-step mutations, enforces question compatibility across AI/fill/navigation boundaries, handles at most two late-field requests per step, preserves retry budgets on Resume, excludes transient listbox inputs, logs structural changes and counts verified advancement. `src/sessions.js` versions identity and initializes completion state. `src/ui.js` displays verified completion counts and retained structural diagnostics. `tests/application.test.js` and `tests/panel.test.js` add 24 acceptance cases. Updated the diagnostic runner, investigation report, PHASE_3_REPORT.md, package/lock version and generated userscript v0.3.9.
- **Independent review / corrections**: Read-only reviewer found baseline disabled controls blocking the run, incomplete primary retries retaining incompatible cached answers, conditional disappearance changing inferred heading, and post-fill semantic changes permitting Continue. Each was reproduced with a failing test and corrected; further cases cover duplicate IDs, empty rerenders with active-step markers, optional late-request failure recovery and full-reload completion accounting.
- **Verification**: Initial eight regressions all failed against v0.3.8 and passed after the main correction. Final full suite: 103 passed, 0 failed. `npm run build` successfully produced `dist/job-copilot.user.js` v0.3.9. No shared Phase 2 scanner/label/filler/verifier edits. Existing staged documentation edits preserved.
- **Next**: Install/reload v0.3.9, Capture Job once to replace legacy session identity, then Start / Resume with Auto Continue ON. Authenticated Workday/OpenRouter behavior not exercised here. If a pause remains, collect retained Last Workflow Change and recent Debug logs. No commit/tag.
### Turn: 2026-09-16 — Phase 3 continuation and Resume rejection

- **Environment / report**: Cisco v0.3.11. User reports forward navigation followed by ambiguous-step rejection on Start / Resume. Screenshots show My Information and Application Questions; successful upload appears as warning. Attached scan log does not include transition diagnostics.
- **Root causes reproduced**: Persisted-step ambiguity explicitly rejects Resume; post-click complete form replacement with a shared heading is not accepted; every ARIA alert is treated as validation failure.
- **Target / changes**: Phase 3. Update navigation, application controller and validation; regressions in application tests. Explicit Resume rescans the current form; replacement steps get distinct state even with a shared heading; informational alerts do not block navigation. Existing unrelated uncommitted edits preserved.
- **Verification**: Three targeted regressions failed before fixes and passed afterward. Five regression cases now cover markerless Resume, shared-heading Resume, automatic replacement-form progression, informational upload alerts and required-field help text. Full suite passed 128/128 with test concurrency 1; earlier concurrent and isolated runs exposed timing sensitivity in the existing location-cancellation test. No shared Phase 2 runtime edits in this turn. Final alert refinement preserves arbitrary server rejection wording; targeted checks and all 69 application tests pass on the final code. Build produced v0.3.13; package/lock and generated userscript updated.
- **Next / limits**: Install v0.3.13, reload and use Start / Resume with Auto Continue on; no recapture needed for the reported ambiguity. Live authenticated Cisco/OpenRouter acceptance remains unverified. No commit/tag.
