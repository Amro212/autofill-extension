# Phase 3 — Application Engine

## Goal

Turn one-page autofill into a persistent application workflow:

```text
job listing
-> capture job context
-> application session
-> fill page
-> validate
-> repair
-> auto-continue
-> next page
```

## Add

```text
src/
  jobs.js
  sessions.js
  pageClassifier.js
  validation.js
  navigation.js
  memory.js
```

## Job capture

Capture when reasonably detectable:
- company
- title
- location
- job ID
- description
- listing URL
- application URL

Store in GM storage.

## Session

Persist:
- session ID
- job context
- current URL
- page history
- answers
- errors
- status
- timestamps

Use Tampermonkey tab APIs when useful plus a persistent recent-session fallback.

## Page classification

Classify:
- unrelated
- job listing
- application page
- review/final
- confirmation
- CAPTCHA
- user boundary

## Validation

Before Continue inspect:
- required fields
- native validity
- aria-invalid
- visible errors
- disabled Continue

## Repair

If invalid:
1. rescan
2. map error to field
3. local repair
4. AI repair if semantic answer is rejected
5. verify
6. retry

Bound attempts.

## Auto Continue

Default ON.

Find likely Next/Continue/Save and Continue/Review controls. Click only after validation and verify the page/step actually changed.

## CAPTCHA and boundaries

CAPTCHA: wait only, never bypass.

Pause on:
- assessment
- identity verification
- recorded/video interview
- e-signature/legal attestation

## Memory

Implement simple:
- application-specific memory
- global normalized question/answer memory

No vector DB.

## Codex task

Implement only Phase 3. Build a deterministic multi-step fixture with validation failure, fake CAPTCHA state, and fake assessment boundary. Produce `PHASE_3_REPORT.md`. Stop for manual approval.

## Manual acceptance — HARD GATES

### Gate 1: Job capture
On a real job listing:
- [x] title captured
- [x] company captured correctly or visibly marked uncertain
- [x] description stored
- [x] URL stored
- [x] panel shows job context

### Gate 2: Session continuity
- [x] application links to captured job
- [x] refresh preserves session
- [x] next step keeps same session
- [x] previous answers/history remain

### Gate 3: Validation repair
Use rejection fixture:
- [x] validation failure detected
- [x] correct field identified
- [x] repair attempted
- [x] repaired value verified
- [x] Continue retried
- [x] retries bounded/visible

### Gate 4: Auto Continue
- [x] step 1 fills
- [ ] continues automatically
- [ ] step 2 detected after transition
- [ ] step 2 fills
- [ ] flow reaches review

### Gate 5: Review stop
Auto Submit OFF:
- [ ] final/review page reached
- [ ] no submit
- [ ] panel says ready for review

### Gate 6: CAPTCHA
- [x] fake CAPTCHA pauses workflow
- [x] no solve attempt
- [x] removing fake CAPTCHA resumes workflow

### Gate 7: Boundary
- [x] fake assessment pauses
- [x] reason displayed
- [x] no assessment answer/advance

### Gate 8: Memory
- [x] repeated common question can reuse prior answer
- [x] unrelated application does not inherit wrong application-specific answer

**PASS — Accepted and signed off by user.**
