# Security and Privacy

The backend accepts only loopback hosts and rejects private routes without a
paired bearer token. A one-time pairing secret is printed locally; the stored
token is hashed server-side and the bearer token remains in extension storage
and background/isolated contexts. It is never injected into page MAIN world.

Profile data, resume content, answer memory, generated documents, API keys, and
SQLite files are local private data. OpenRouter receives only the prompt context
needed for an enabled AI action. The mock provider sends nothing externally.
Job and form text are untrusted prompt data, not instructions.

Upload size, type, and filename are validated. JSON bodies use strict Zod
schemas. Debug export removes values, raw bytes/base64, tokens, secrets,
prompts/outputs, query strings, email addresses, phone-like values, and bearer
patterns; users should still review a bundle before sharing it.

Automation never bypasses CAPTCHA, assessments, signatures, identity checks,
legal attestations, or consent. Auto Submit defaults off and requires a verified
final page. Stop the server before `pnpm backup`; backups contain highly
sensitive personal data and must be protected or encrypted by the user.
