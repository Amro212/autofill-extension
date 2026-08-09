# Application State Machine

Sessions persist across tabs, domains, reloads, and server restarts. Normal
progression is:

`DISCOVERED → APPLICATION_LINKED → SCANNING → GENERATING → FILLING → VERIFYING`

Verification may enter `REPAIRING` and return to scanning. A valid non-final
page enters `NAVIGATING`; a verified final page enters `READY_TO_SUBMIT`.
Submission requires Auto Submit, high-confidence final-page classification, and
successful final validation: `READY_TO_SUBMIT → SUBMITTING → SUBMITTED`.

CAPTCHA enters `AWAITING_CAPTCHA`; external assessment, identity, signature,
legal attestation, or consent pages enter `USER_BOUNDARY`. Both wait for the
user and can resume scanning. `PAUSED` is explicit user control. `FAILED` is
recoverable through a fresh scan. Illegal transitions are rejected by the
shared state-machine package and by the authenticated persistence API.
