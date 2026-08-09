import { randomUUID } from "node:crypto";

import {
  applicationCreateSchema,
  applicationSessionSchema,
  type ApplicationCreate,
  type ApplicationSession,
  type ApplicationState,
} from "@job-copilot/contracts";
import { transitionApplication } from "@job-copilot/application-core";
import { and, desc, eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { applications } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";
import type { SettingsRepository } from "./settings.js";

export class ApplicationRepository {
  readonly #userId: string;

  constructor(
    private readonly db: JobCopilotDatabase,
    private readonly settings: SettingsRepository,
  ) {
    this.#userId = ensureLocalUser(db);
  }

  create(input: ApplicationCreate): ApplicationSession {
    const create = applicationCreateSchema.parse(input);
    const automation = this.settings.get();
    const now = new Date().toISOString();
    const session = applicationSessionSchema.parse({
      id: randomUUID(),
      userId: this.#userId,
      state: "DISCOVERED",
      ...create,
      aiAutofill: automation.aiAutofill,
      autoContinue: automation.autoContinue,
      autoSubmit: automation.autoSubmit,
      autopilot: automation.autopilot,
      createdAt: now,
      updatedAt: now,
    });
    this.db.insert(applications).values({
      id: session.id,
      userId: session.userId,
      jobId: session.jobId,
      state: session.state,
      dataJson: JSON.stringify(session),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }).run();
    return session;
  }

  get(id: string): ApplicationSession | undefined {
    const row = this.db
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, this.#userId)))
      .get();
    return row === undefined ? undefined : applicationSessionSchema.parse(JSON.parse(row.dataJson));
  }

  findByTab(tabId: number): ApplicationSession | undefined {
    const rows = this.db
      .select()
      .from(applications)
      .where(eq(applications.userId, this.#userId))
      .orderBy(desc(applications.updatedAt))
      .all();
    for (const row of rows) {
      const session = applicationSessionSchema.parse(JSON.parse(row.dataJson));
      if (
        session.originatingTabId === tabId ||
        session.activeTabIds?.includes(tabId) === true
      ) {
        return session;
      }
    }
    return undefined;
  }

  transition(id: string, to: ApplicationState): ApplicationSession | undefined {
    const current = this.get(id);
    if (current === undefined) return undefined;
    const state = transitionApplication(current.state, to);
    const updatedAt = new Date().toISOString();
    const session = applicationSessionSchema.parse({
      ...current,
      state,
      updatedAt,
      ...(state === "SUBMITTED" ? { submittedAt: updatedAt } : {}),
    });
    this.db
      .update(applications)
      .set({
        state,
        dataJson: JSON.stringify(session),
        updatedAt,
      })
      .where(and(eq(applications.id, id), eq(applications.userId, this.#userId)))
      .run();
    return session;
  }
}
