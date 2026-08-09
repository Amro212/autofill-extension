# AI Pipeline

The backend owns provider credentials and applicant context. The extension sends
only normalized page fields plus an optional application ID. The backend loads
profile, job, canonical resume facts, and ranked answer memory, then makes one
structured request for the page. Individual requests are reserved for Rewrite
or bounded repair.

`LlmProvider` supports deterministic mock evaluation and OpenRouter. Runtime
provider/model are selected with `.env` and shown read-only in Settings. Output
must pass strict Zod schemas, match requested field IDs, contain no duplicates,
and respect constraints. One schema-repair attempt is allowed; then the action
fails visibly. Provider errors never trigger infinite retries.

Prompts treat job/form text as untrusted data. They prohibit invented jobs,
projects, credentials, dates, metrics, tools, leadership, achievements, and
experience length. Legal attestations, signatures, identity checks, consent,
CAPTCHA, and assessments are user boundaries. Narrative answers and rewrites
are recorded with source, confidence, inference flag, and rationale code.
Global memory is used across safe contexts; application memory never leaks to a
different application.
