# Architecture

Job Copilot is a pnpm monorepo with one source tree for two WXT builds.

- `apps/extension`: isolated content runtime, Shadow DOM React panel, background
  service worker, small MAIN-world bridge, ATS adapters, field/navigation engine.
- `apps/server`: loopback Fastify API, bearer pairing, SQLite/Drizzle
  repositories, AI provider abstraction, document parsing/rendering/storage.
- `packages/contracts`: shared Zod wire and persistence contracts.
- `packages/field-core`, `application-core`, `ai-core`: deterministic domain
  primitives with no browser or server ownership.

The content script observes and normalizes DOM state. Sensitive profile,
resume, token, and AI context stay in the extension isolated world or backend.
The MAIN-world bridge receives only narrow field actions needed for controlled
framework inputs. The background owns the bearer token and proxies API calls.

The main loop is Observe → Understand → Decide → Act → Verify → Repair. A
debounced observer rescans relevant changes; the application controller batches
one AI answer request per page, executes sequentially, verifies actual DOM
state, repairs bounded failures, uploads selected documents, then navigates.

SQLite is the durable source of truth for profiles, jobs, sessions, settings,
answers, memories, document metadata, and canonical resumes. File bytes live
under the configured private data directory. Migrations are forward-only and
tracked with SQLite `user_version`.
