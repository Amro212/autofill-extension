# Architecture

## 1. System Overview

```text
                        JOB LISTING / ATS PAGE
                                 |
                                 v
                    +---------------------------+
                    | WXT Browser Extension     |
                    | Firefox / Zen / Chromium  |
                    +---------------------------+
                      |        |          |
                      |        |          |
                 ISOLATED   MAIN-WORLD   UI
                  content     bridge     panel
                   script       |
                      \          /
                       \        /
                        v      v
                     Browser Engine
                        |
        +---------------+----------------+
        |               |                |
        v               v                v
   Job Capture      Field Engine     Navigation
        |               |                |
        +---------------+----------------+
                        |
                        v
                Application Session API
                        |
                        v
              +-----------------------+
              | Local TypeScript API  |
              | 127.0.0.1 only        |
              +-----------------------+
                |       |        |
                v       v        v
             SQLite  Documents  OpenRouter
                |       |        |
                +-------+--------+
                        |
                        v
             AI / Memory / Generation
```

## 2. Browser Extension

Use **WXT + React + TypeScript**.

The extension is not a thin userscript anymore. It is the real browser client and should use standard WebExtension architecture:

### Background/service worker
Responsible for:
- backend connectivity and pairing
- tab/session correlation
- browser navigation events where available
- cross-tab job/application correlation
- extension settings
- messaging orchestration
- downloads / extension-safe privileged actions where needed

### Isolated content script
Responsible for:
- persistent control panel
- safe DOM observation
- job/application page classification
- field discovery coordination
- highlighting and rewrite UI
- communicating normalized actions to the page-world bridge
- communicating with background/backend

### Main-world bridge
Responsible only for page-context actions that genuinely need to run in the website's JavaScript world.

Examples:
- framework-controlled input interactions
- custom React/Radix widgets that do not respond reliably from isolated content world
- page-native objects/hooks when absolutely necessary

Keep this bridge minimal.

Do not expose secrets or applicant context to MAIN-world code.

### Shadow DOM UI
Mount the in-page panel and field controls in Shadow DOM.

Host page CSS must not alter the extension UI, and extension CSS must not leak into the ATS page.

## 3. Cross-browser rule

The codebase must produce separate Firefox and Chromium builds.

Avoid scattering browser-specific checks throughout the code. Place them behind compatibility helpers.

Suggested package:

```text
packages/browser-runtime/
  src/
    messages.ts
    tabs.ts
    scripting.ts
    navigation.ts
    storage.ts
    permissions.ts
```

## 4. Local backend

Recommended v1 stack:

- Node.js
- TypeScript
- Fastify
- Zod
- SQLite
- Drizzle ORM
- structured logging
- filesystem document store behind a storage abstraction

The backend must bind to `127.0.0.1`, not all network interfaces, by default.

Suggested default port may be configurable. Do not hardcode architectural assumptions around a specific port.

## 5. Monorepo

```text
job-copilot/
|
+-- apps/
|   +-- extension/
|   |   +-- entrypoints/
|   |   +-- src/
|   |   |   +-- ui/
|   |   |   +-- browser/
|   |   |   +-- observer/
|   |   |   +-- page-classifier/
|   |   |   +-- fields/
|   |   |   +-- adapters/
|   |   |   +-- navigation/
|   |   |   +-- validation/
|   |   |   +-- uploads/
|   |   |   +-- sessions/
|   |   |   +-- bridge/
|   |   |   +-- debug/
|   |   |   +-- api/
|   |   |   +-- compatibility/
|   |   +-- tests/
|   |
|   +-- server/
|       +-- src/
|       |   +-- api/
|       |   +-- auth/
|       |   +-- db/
|       |   +-- profile/
|       |   +-- jobs/
|       |   +-- applications/
|       |   +-- memory/
|       |   +-- documents/
|       |   +-- ai/
|       |   +-- providers/
|       |   +-- generation/
|       |   +-- settings/
|       |   +-- logging/
|       +-- tests/
|
+-- packages/
|   +-- contracts/
|   +-- application-core/
|   +-- field-core/
|   +-- ats-core/
|   +-- ai-core/
|   +-- document-core/
|   +-- browser-runtime/
|
+-- references/             # gitignored clones/audit notes
+-- docs/
+-- scripts/
+-- data/                   # gitignored local runtime data
+-- package.json
+-- pnpm-workspace.yaml
+-- tsconfig.base.json
+-- README.md
```

Use pnpm workspaces. A task runner is optional; do not add Turborepo unless it solves a real problem.

## 6. Core abstraction boundaries

The extension must not know OpenRouter details.

The backend must not know DOM details.

The field engine must not know applicant-profile persistence details.

The ATS adapters must not call the LLM directly.

The document generator must not know how an ATS upload control works.

The navigation engine must not invent answers.

Keep these boundaries explicit.

## 7. Product migration path

The v1 architecture must permit:

```text
Local backend
    -> hosted authenticated API

Single local profile
    -> multi-user accounts

Unpacked extension
    -> Firefox Add-ons / Chrome Web Store

Local document store
    -> object storage

Local OpenRouter key
    -> server-managed provider credentials

Single applicant
    -> SaaS users
```

Do not implement full SaaS multi-tenancy now.

Do use IDs and service interfaces that avoid a dead end.
