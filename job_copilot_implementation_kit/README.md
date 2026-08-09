# Job Copilot Implementation Kit

This kit is the source of truth for building the Job Copilot browser extension and local backend.

## Locked Product Decisions

- Browser shell: **WXT + React + TypeScript WebExtension**
- Browsers: Firefox/Zen first, Chromium-compatible from the same codebase
- Backend: **local Node.js + TypeScript API for v1**
- Persistence: SQLite behind a repository abstraction
- Extension/backend auth: mandatory per-installation pairing token
- Default behavior:
  - AI Autofill: ON after user explicitly starts an application
  - Auto Continue: ON
  - Auto Submit: OFF
  - Optional Autopilot mode can start automatically on detected applications
- Application sessions persist across pages, SPA navigation, tabs, and ATS domains
- Job descriptions should be captured before leaving a job listing whenever possible
- Default AI model target: **Gemini 3.5 Flash Lite via OpenRouter**, with the exact current OpenRouter model slug resolved/verified during implementation and stored as configuration
- AI scope includes:
  - page-level form answering
  - rewrite/regenerate
  - answer memory
  - resume tailoring
  - cover letter generation
  - document selection
- File handling is in v1, not deferred
- The engine must support generic pages plus ATS-specific adapters
- The browser engine must follow: **observe -> decide -> act -> verify -> repair**
- Human-like typing animation, fake mouse movement, and anti-bot behavior simulation are NOT design goals
- Assessments, identity verification, recorded/video interviews, and electronic signature/legal-declaration flows are user boundaries
- CAPTCHA is never bypassed. The extension waits and resumes if it clears normally.
- Default final submission remains user-controlled. Auto Submit is an explicit opt-in.

## Read Order

1. `MASTER_AGENT_PROMPT.md`
2. `ARCHITECTURE.md`
3. `SOURCE_REUSE_AUDIT.md`
4. `APPLICATION_STATE_MACHINE.md`
5. `FIELD_ENGINE.md`
6. `AI_AND_DOCUMENTS.md`
7. `DATA_CONTRACTS.md`
8. `SECURITY.md`
9. `IMPLEMENTATION_PHASES.md`
10. `TESTING_AND_ACCEPTANCE.md`

## Core Principle

Do not build a blind macro.

The browser runtime must continuously determine what is actually present, normalize it into a stable internal model, act through the real rendered controls, verify the resulting page state, repair errors, and only then continue.
