# Job Copilot — Tampermonkey 6-Phase Implementation Kit

This kit replaces the previous extension/backend architecture.

## Locked architecture

```text
Normal Browser
    |
Tampermonkey
    |
job-copilot.user.js
    |
    +-- Control Panel
    +-- GM Storage
    +-- Job Capture
    +-- Application Sessions
    +-- Generic Field Engine
    +-- ATS Adapters
    +-- OpenRouter AI
    +-- Answer Memory
    +-- Resume/Cover Letter Generation
    +-- Document Library
    +-- Upload Engine
    +-- Validation / Repair
    +-- Auto Continue
    +-- Optional Auto Submit
    +-- Future Outreach Hooks
```

No backend, SQLite, localhost service, WXT, or external runtime browser automation.

Develop modular source and bundle it into one installable file:

```text
src/
  main.js
  storage.js
  ui.js
  observer.js
  jobs.js
  sessions.js
  ai.js
  fields/
  adapters/
  documents/
  outreach/

dist/job-copilot.user.js
```

Use esbuild or an equivalent minimal bundler.

## Phase order

1. Foundation
2. Generic AI Autofill
3. Application Engine
4. ATS Hardening
5. Documents + AI Tailoring
6. Product Polish + Outreach Hooks

**Do not move to the next phase until the user manually passes every HARD GATE in the current phase.**
