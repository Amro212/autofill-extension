# Job Copilot v1 Design

## Status

Approved by the supplied implementation kit and `MASTER_AGENT_PROMPT.md`. The kit locks product scope, architecture, technology, safety boundaries, acceptance criteria, and grants autonomous authority to implement without another planning handoff.

## Product boundary

Job Copilot is a cross-browser WebExtension plus authenticated loopback service. It captures job context, correlates application sessions across tabs and domains, discovers arbitrary form controls, asks an AI provider for one structured set of answers per page, acts through rendered controls, verifies resulting state, repairs bounded failures, and progresses until final review. Optional auto-submit remains off by default. CAPTCHA, assessments, identity verification, electronic signatures, and legally meaningful attestations are explicit user boundaries.

## Considered approaches

1. **Extension plus local service (selected).** WXT/React handles browser observation and interaction; Fastify/SQLite owns credentials, persistence, AI, and documents. This matches all locked decisions, keeps secrets outside hostile pages, and leaves a migration path to a hosted API.
2. **Extension-only.** Simpler deployment, but exposes provider credentials and makes document storage/generation and durable relational state unsafe or brittle. Rejected.
3. **Hosted-first SaaS.** Simplifies multi-device use, but adds auth, tenancy, deployment, and privacy scope explicitly deferred from v1. Rejected.

## Architecture

The pnpm workspace contains `apps/extension`, `apps/server`, and narrow shared packages. Contracts are serializable and Zod-validated at API and message boundaries. Browser-only element references never leave the content runtime. The backend never sees DOM nodes/selectors, and ATS adapters never call AI providers.

The extension uses:

- background/service worker for pairing, API calls, persistent settings, browser lifecycle, and tab/session correlation;
- isolated content script for observation, classification, the Shadow DOM panel, field registry, orchestration, and verification;
- a minimal main-world bridge for framework-sensitive setters and widgets, receiving only narrow actions over a per-page channel;
- browser compatibility helpers instead of scattered target checks.

The service binds to `127.0.0.1`, requires an installation-scoped bearer token, validates all payloads, stores structured data behind repository interfaces, resolves opaque document IDs internally, and redacts secrets from logs and debug bundles.

## Core data flow

```text
listing -> capture job -> correlate application -> persistent session
        -> observe/classify -> discover/normalize fields
        -> load profile/job/resume/memory -> one structured AI request
        -> locate/act/wait/read/verify -> repair bounded failures
        -> validate -> continue or stop at review/boundary
```

All model output is data. The backend validates field IDs, value types, lengths, dates, and option membership. The provider has no file, network, or code-execution tools. Applicant facts and untrusted job/page text occupy separate prompt sections.

## Persistence and documents

SQLite stores users, profiles, settings, jobs, application sessions, snapshots, actions, answers, memory, documents, and provenance. Files live under a configured storage root addressed only by generated keys. PDF/DOCX imports become source records and a canonical structured resume. Tailoring selects, reorders, or rewrites supported facts; deterministic single-column renderers emit text-based PDF and DOCX artifacts with provenance.

## Field engine

ATS scanners enhance a generic semantic scanner; fallback always remains active. All fields normalize into one contract. Every mutation captures an undo snapshot and follows `locate -> scroll -> act -> wait -> read -> verify`. Local executor retries, semantic AI repairs, navigation attempts, and full rescans are independently bounded and journaled.

## Error handling

Typed errors cross package boundaries. One field, provider call, upload, or adapter failure cannot crash the runtime. The application state machine rejects illegal transitions, persists after every meaningful transition, and recovers after reload/SPA changes/browser restarts. Unresolved required fields pause progression with evidence.

## Testing

Vitest covers contracts, state transitions, matching, security, repositories, AI schemas, memory, and truthfulness. Integration tests cover authenticated extension-service flows, persistence, documents, provider mocks, and generation. Playwright is development/test tooling only; local fixtures verify actual rendered state for React inputs, async widgets, uploads, validation repair, multi-page navigation, final submission settings, CAPTCHA, and user boundaries. WXT Firefox and Chromium production builds are release gates.

## Delivery strategy

Work proceeds vertically: mandatory donor audit; runnable paired extension/service skeleton; persistent profile and documents; job-to-form mock-AI slice; then advanced controls, live provider, repair/navigation, generation, ATS adapters, cross-browser hardening, and release acceptance. Each stable slice is tested and committed.
