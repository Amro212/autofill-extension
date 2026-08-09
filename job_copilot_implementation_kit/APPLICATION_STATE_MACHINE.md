# Application State Machine

Treat every application as one persistent session.

## States

```text
DISCOVERED
JOB_CONTEXT_CAPTURED
APPLICATION_LINKED
WAITING_FOR_USER_START
SCANNING
GENERATING
FILLING
VERIFYING_FIELDS
REPAIRING
VALIDATING_PAGE
READY_TO_CONTINUE
NAVIGATING
AWAITING_CAPTCHA
USER_BOUNDARY
READY_TO_SUBMIT
SUBMITTING
SUBMITTED
FAILED
PAUSED
```

## Default flow

```text
Job listing detected
      |
      v
JOB_CONTEXT_CAPTURED
      |
user opens/clicks application
      |
      v
APPLICATION_LINKED
      |
      v
WAITING_FOR_USER_START
      |
click Autofill Application
      |
      v
SCANNING
      |
      v
GENERATING
      |
      v
FILLING
      |
      v
VERIFYING_FIELDS
      |
   errors?
   /    \
 yes     no
 |        |
 v        v
REPAIRING VALIDATING_PAGE
 |        |
 +--------+
      |
 page valid?
  /      \
 no       yes
 |         |
 v         v
REPAIRING  READY_TO_CONTINUE
              |
       Auto Continue ON
              |
              v
          NAVIGATING
              |
          next step
              |
              v
           SCANNING
```

## Final page

If final submission is confidently detected:

```text
READY_TO_SUBMIT
     |
     +-- Auto Submit OFF -> stop for review
     |
     +-- Auto Submit ON
              |
              v
          SUBMITTING
              |
              v
          verify confirmation
              |
              v
           SUBMITTED
```

## Autopilot mode

Default OFF.

If ON, a confidently detected application may transition from `APPLICATION_LINKED` directly into `SCANNING` without waiting for the user to press Autofill.

Autopilot must be independently configurable from Auto Submit.

## CAPTCHA

Never solve, bypass, or manipulate CAPTCHA.

```text
CAPTCHA detected
      |
      v
AWAITING_CAPTCHA
      |
observe only
      |
CAPTCHA disappears / page advances normally
      |
      v
SCANNING
```

## User boundaries

Stop autonomous progression at:
- coding assessment
- take-home assessment portal
- psychometric/personality assessment
- recorded/video interview
- identity verification
- electronic signature
- explicit legal declaration/attestation page where submission itself is legally meaningful

Set:

`USER_BOUNDARY`

Explain why in panel.

## Repair loop

Bound retries.

Suggested defaults:
- field-level local strategy attempts: 3
- AI repair attempts: 2
- navigation attempts: 3
- page-level full rescans: 3

Every retry must have a reason.

Never implement an infinite loop.

## Session recovery

After:
- full page reload
- SPA route change
- new tab
- redirect to ATS domain
- login page
- browser restart

attempt to recover the active application session using:
- explicit extension tab/session mapping
- job ID
- application URL
- ATS domain
- company/title
- originating tab
- recency
- persisted session state

If multiple sessions plausibly match and confidence is insufficient, ask a minimal one-line confirmation in the extension UI.
