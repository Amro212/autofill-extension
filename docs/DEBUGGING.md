# Debugging

The panel’s Debug section shows the active adapter, application session ID, normalized field count, recent action types, and bounded error codes. “Export Debug Bundle” downloads `job-copilot-debug-<timestamp>.json` locally.

## Bundle contents

- format/version and generation time
- adapter and session ID
- page origin and pathname (query and fragment omitted)
- normalized field IDs, kinds, labels, and required state
- last 200 structured events
- scan/page classification history
- field action outcomes without values
- upload outcomes without file bytes
- validation code history
- AI task/count metadata without prompts or responses
- application state transitions and automation outcomes

## Redaction

The journal removes value-like keys, raw content, bytes/base64, authorization, tokens, secrets, passwords, prompts, outputs, and responses. It also replaces email addresses, bearer credentials, and phone-like strings in messages. Do not attach private documents, the SQLite database, or browser storage to bug reports.

Debug bundles are ignored by Git under `debug-bundles/`. Review an export before sharing because tenant field labels and job URLs can still reveal the employer or role.

## Error codes

The UI and journal use the project taxonomy, including `BACKEND_OFFLINE`, `BACKEND_UNPAIRED`, `SESSION_CORRELATION_FAILED`, `JOB_CONTEXT_MISSING`, `FIELD_DISCOVERY_FAILED`, `FIELD_ACTION_FAILED`, `FIELD_VERIFICATION_FAILED`, `FIELD_VALUE_REJECTED`, `VALIDATION_FAILED`, `NAVIGATION_FAILED`, `UPLOAD_FAILED`, `DOCUMENT_GENERATION_FAILED`, `LLM_TIMEOUT`, `LLM_PROVIDER_ERROR`, `LLM_INVALID_RESPONSE`, `CAPTCHA_WAIT`, and `USER_BOUNDARY`.

## Local diagnosis

1. Confirm `GET /health` responds from the loopback backend.
2. Re-pair if the panel reports `unpaired`.
3. Open Debug and confirm adapter, session, and field count.
4. Use Scan, then Retry Failed.
5. Export the debug bundle after the failure.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` from the repository root.
