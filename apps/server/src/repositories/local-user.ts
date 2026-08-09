import { eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { users } from "../db/schema.js";

export const LOCAL_USER_ID = "local-user";

export function ensureLocalUser(db: JobCopilotDatabase): string {
  const existing = db.select().from(users).where(eq(users.id, LOCAL_USER_ID)).get();
  if (existing === undefined) {
    const now = new Date().toISOString();
    db.insert(users)
      .values({ id: LOCAL_USER_ID, createdAt: now, updatedAt: now })
      .run();
  }
  return LOCAL_USER_ID;
}

