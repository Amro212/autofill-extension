# Context, Findings & Change Log

This file tracks user-reported findings, platform bugs, audit analyses, and code changes made across conversation turns. All agents must update this document whenever bugs/findings are discussed or changes are applied.

---

## Findings & Bug Reports

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
