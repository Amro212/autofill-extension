import {
  automationSettingsDataSchema,
  automationSettingsSchema,
  automationSettingsUpdateSchema,
  type AutomationSettings,
  type AutomationSettingsUpdate,
} from "@job-copilot/contracts";
import { eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { settings } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export class SettingsRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  get(): AutomationSettings {
    let row = this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, this.#userId))
      .get();
    if (row === undefined) {
      const defaults = automationSettingsDataSchema.parse({});
      row = {
        userId: this.#userId,
        ...defaults,
        updatedAt: new Date().toISOString(),
      };
      this.db.insert(settings).values(row).run();
    }
    return automationSettingsSchema.parse(row);
  }

  update(input: AutomationSettingsUpdate): AutomationSettings {
    const patch = automationSettingsUpdateSchema.parse(input);
    const current = this.get();
    const updated = automationSettingsSchema.parse({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    this.db
      .update(settings)
      .set(updated)
      .where(eq(settings.userId, this.#userId))
      .run();
    return updated;
  }
}

