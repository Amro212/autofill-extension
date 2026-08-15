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
- [ ] title captured
- [ ] company captured correctly or visibly marked uncertain
- [ ] description stored
- [ ] URL stored
- [ ] panel shows job context

### Gate 2: Session continuity
- [ ] application links to captured job
- [ ] refresh preserves session
- [ ] next step keeps same session
- [ ] previous answers/history remain

### Gate 3: Validation repair
Use rejection fixture:
- [ ] validation failure detected
- [ ] correct field identified
- [ ] repair attempted
- [ ] repaired value verified
- [ ] Continue retried
- [ ] retries bounded/visible

### Gate 4: Auto Continue
- [ ] step 1 fills
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
- [ ] fake CAPTCHA pauses workflow
- [ ] no solve attempt
- [ ] removing fake CAPTCHA resumes workflow

### Gate 7: Boundary
- [ ] fake assessment pauses
- [ ] reason displayed
- [ ] no assessment answer/advance

### Gate 8: Memory
- [ ] repeated common question can reuse prior answer
- [ ] unrelated application does not inherit wrong application-specific answer

**PASS only when all gates pass.**
