# Testing and Acceptance

## 1. Required test layers

### Unit
- field label extraction
- field normalization
- option matching
- question signatures
- state transitions
- Zod AI schemas
- job-description normalization
- memory ranking
- document metadata
- filename sanitization
- resume-tailoring truthfulness validators

### Integration
- extension background <-> backend
- pairing
- session persistence
- provider mock
- document streaming
- job capture
- answer memory
- document generation workflow

### Browser
Use local fixtures plus representative real ATS pages when available.

Fixtures:
- native HTML
- controlled React input
- custom Radix-like combobox
- async autocomplete
- native select
- radio
- checkbox
- checkbox group
- contenteditable
- rich text
- date input
- custom date picker
- file upload
- hidden file input
- repeated sections
- validation failure
- disabled Continue until valid
- SPA multi-step flow
- final review + Submit
- CAPTCHA placeholder state
- assessment boundary page

## 2. Observe -> act -> verify tests

Every executor test must verify page state, not just emitted events.

Examples:
- text survives React rerender
- selected combobox text and hidden state both update where applicable
- upload shows accepted filename
- Continue produces next-step transition
- Submit produces confirmation

## 3. Generic acceptance

- [ ] WXT Firefox build installs
- [ ] WXT Chromium build installs
- [ ] panel renders in Shadow DOM
- [ ] backend pairing succeeds
- [ ] unpaired localhost API is rejected
- [ ] profile CRUD works
- [ ] document library works
- [ ] job listing capture works
- [ ] application context transfers to ATS tab
- [ ] application session persists
- [ ] SPA route changes are detected
- [ ] dynamically inserted fields are detected
- [ ] native text works
- [ ] React-controlled text works
- [ ] native select works
- [ ] radio works
- [ ] checkbox works
- [ ] custom combobox works
- [ ] autocomplete works
- [ ] date works
- [ ] contenteditable works
- [ ] existing values may be replaced
- [ ] field scrolling works
- [ ] modifications are highlighted
- [ ] Undo works
- [ ] page-level AI request fills multiple fields
- [ ] Rewrite with feedback works
- [ ] AI output schema validation works
- [ ] provider retries are bounded
- [ ] global memory works
- [ ] application memory works
- [ ] validation errors are detected
- [ ] failing field repair works
- [ ] Auto Continue works
- [ ] navigation failures are retried
- [ ] Auto Submit OFF stops at final review
- [ ] Auto Submit ON submits only a verified final page
- [ ] upload engine handles representative controls
- [ ] CAPTCHA is not bypassed
- [ ] CAPTCHA wait can resume
- [ ] assessment boundaries pause automation
- [ ] debug bundle works

## 4. AI/document acceptance

- [ ] PDF resume import
- [ ] DOCX resume import
- [ ] canonical structured resume
- [ ] editable profile populated from resume suggestions
- [ ] tailored resume generation
- [ ] tailored PDF output
- [ ] tailored DOCX output
- [ ] generated resume remains text based
- [ ] generated resume facts trace to source records
- [ ] cover letter generation
- [ ] cover letter PDF/DOCX
- [ ] generated documents persisted with provenance
- [ ] application can automatically choose/generated required resume
- [ ] generated document uploads successfully

## 5. ATS support definition

An ATS is not "supported" merely because generic inputs happen to work.

For an adapter to be marked supported:
- job/app page detection tested
- text fields tested
- custom selects tested
- dates tested if used
- repeated sections tested if used
- uploads tested
- validation tested
- multi-page navigation tested
- regression fixture exists
- known limitations documented

## 6. Cross-browser acceptance

Firefox/Zen:
- [ ] startup
- [ ] content injection
- [ ] Shadow DOM UI
- [ ] MAIN-world bridge
- [ ] localhost API
- [ ] fields
- [ ] uploads
- [ ] navigation

Chromium:
- [ ] startup
- [ ] content injection
- [ ] Shadow DOM UI
- [ ] MAIN-world bridge
- [ ] localhost API
- [ ] fields
- [ ] uploads
- [ ] navigation

## 7. Performance

- observer must be debounced
- do not repeatedly scan whole DOM on every mutation
- no runaway timers
- no infinite retries
- UI must remain responsive
- page should remain usable while panel is active

## 8. Completion definition

The coding agent may only declare v1 complete when:
1. tests pass
2. both browser builds work
3. local backend launches from documented setup
4. at least generic multi-step flow works end to end
5. Workday and Greenhouse adapters have been validated on representative current structures
6. AI page answering works
7. resume tailoring works
8. cover-letter generation works
9. document upload works
10. validation repair and auto-navigation work
11. user boundaries work
12. debug export exists
13. docs are current
