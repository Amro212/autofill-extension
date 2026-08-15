# Phase 6 — Product Polish + Outreach Hooks

## Goal

Turn the working system into a stable personal daily-use v1 and prepare clean hooks for later outreach.

## Scope

### Answer memory
Improve global/application memory:
- normalized question signature
- candidate answers
- usage count
- last used
- manual override/pin
- domain/company context

Company-specific narrative content must not be blindly copied across employers.

### Auto Submit
Default OFF.

When ON:
- final-page classifier confident
- page valid
- no boundary
- no unresolved error
- submit once
- verify confirmation
- update application history

### Application history
Store/display:
- company
- role
- date
- status
- URL
- ATS
- resume used
- cover letter used
- answers
- errors
- submission timestamp

### Debug bundle
Export sanitized JSON containing:
- application/session
- page classification
- fields
- adapter
- errors/retries
- recent actions

Must not include:
- OpenRouter key
- binary documents

### Export/backup
Support:
- profile export
- settings export excluding secret
- history export
- memory export
- optional full local backup with a clear privacy warning

### Outreach-ready model
Do not build a full CRM yet.

Add clean structures/hooks for:

```text
OutreachContact
OutreachMessage
OutreachStatus
FollowUpDate
Source
ApplicationId
```

Possible panel tab:
`Outreach`

Future capabilities should be able to add:
- recruiter/contact association
- generated outreach email
- LinkedIn DM
- follow-up reminders
- outreach history

Keep outreach state isolated from application state.

### Cross-browser regression
Run final Chromium + Tampermonkey sanity tests.

## Codex task

Implement Phase 6 only.

Prioritize:
- memory
- history
- safe Auto Submit
- debug export
- import/export
- Chromium regression
- outreach-ready contracts/hooks

Do not derail into automated email sending, recruiter scraping, CRM, or cloud sync.

Produce:
- `PHASE_6_REPORT.md`
- `V1_KNOWN_LIMITATIONS.md`
- `V1_RELEASE_CHECKLIST.md`

Stop for manual v1 acceptance.

## Manual acceptance — HARD GATES

### Gate 1: Full application regression
Run a complete application flow with Auto Submit OFF:
- [ ] job captured
- [ ] application linked
- [ ] fields filled
- [ ] validation repaired
- [ ] pages advanced
- [ ] correct resume uploaded
- [ ] documents associated
- [ ] final page reached
- [ ] no submission occurred

### Gate 2: Auto Submit
Use a safe local/test submission fixture first:
- [ ] final page classified
- [ ] page validity confirmed
- [ ] submission happens exactly once
- [ ] confirmation detected
- [ ] history becomes Submitted

Return Auto Submit to OFF afterward.

### Gate 3: Memory
- [ ] repeated factual question reuses correct answer
- [ ] manually changed answer can become preferred
- [ ] company-specific answer is not blindly copied to another company
- [ ] memory can be inspected/cleared

### Gate 4: History
- [ ] company/role correct
- [ ] status correct
- [ ] document names correct
- [ ] URLs correct
- [ ] submission timestamp correct when applicable

### Gate 5: Debug bundle
- [ ] valid JSON
- [ ] useful session/field/error information
- [ ] no OpenRouter key
- [ ] no document binary chunks

### Gate 6: Backup/export
- [ ] profile export works
- [ ] settings export excludes secret
- [ ] history export works
- [ ] restore/import test does not corrupt installation

### Gate 7: Outreach readiness
- [ ] contact can associate with an application
- [ ] outreach status can exist independently
- [ ] future message/follow-up fields fit cleanly
- [ ] outreach hooks do not break application workflow

### Gate 8: Chromium regression
On Chromium + Tampermonkey:
- [ ] panel works
- [ ] storage works
- [ ] OpenRouter works
- [ ] generic autofill works
- [ ] one primary ATS works
- [ ] document reconstruction/upload fixture works

### Gate 9: Daily-use stability
Across a normal multi-tab job-search session:
- [ ] no uncontrolled repeated AI requests
- [ ] no session mixing
- [ ] no obvious memory corruption
- [ ] no runaway observer/CPU behavior
- [ ] no API key exposure
- [ ] no accidental submit with Auto Submit OFF

**V1 PASS only when all gates pass.**
