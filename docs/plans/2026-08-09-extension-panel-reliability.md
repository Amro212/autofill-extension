# Extension Panel Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep the paired panel mounted and remove normal-path console errors.

**Architecture:** Add two tiny lifecycle primitives, make session lookup nullable end-to-end, and enable Zod jitless mode at extension startup.

**Tech Stack:** TypeScript, React, WXT, Fastify, Vitest.

---

### Task 1: Panel lifecycle and observation gate

**Files:** `apps/extension/src/ui/lifecycle.ts`, `apps/extension/src/ui/lifecycle.test.ts`, `apps/extension/src/observer/signature.ts`, `apps/extension/src/observer/signature.test.ts`, `apps/extension/entrypoints/content.tsx`

1. Write failing host-reattachment and signature-claim tests.
2. Run them and confirm expected failures.
3. Add minimal helpers and wire them into content startup/inspection.
4. Re-run tests.

### Task 2: Nullable session lookup

**Files:** `apps/server/src/api/applications.ts`, `apps/server/test/sessions.test.ts`, `apps/extension/src/api/client.ts`, `apps/extension/src/sessions/controller.ts`, `apps/extension/src/sessions/controller.test.ts`, `apps/extension/entrypoints/background.ts`

1. Add failing tests for `200 null` and undefined recovery.
2. Implement nullable types and explicit branching; remove catch-all fallback.
3. Re-run focused tests.

### Task 3: CSP-safe validation and full verification

**Files:** `packages/contracts/src/validation.ts`, `apps/extension/entrypoints/background.ts`, `apps/extension/entrypoints/content.tsx`

1. Expose a contracts-owned CSP bootstrap and import it before contract schemas in both entrypoints.
2. Run lint, typechecks, unit/integration tests, Chrome build, Firefox build.
3. Inspect output bundles and manifests.
