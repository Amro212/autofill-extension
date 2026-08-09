import { eq } from "drizzle-orm";

import { createInstallationIdentity } from "../auth/installation.js";
import {
  hashPairingCredential,
  type PersistedPairingState,
} from "../auth/pairing.js";
import type { JobCopilotDatabase } from "../db/client.js";
import { installations } from "../db/schema.js";

export interface InstallationBootstrap extends PersistedPairingState {
  pairingSecret?: string;
}

export class InstallationRepository {
  constructor(private readonly db: JobCopilotDatabase) {}

  getOrCreate(): InstallationBootstrap {
    const existing = this.db.select().from(installations).get();
    if (existing !== undefined) {
      return {
        installationId: existing.installationId,
        pairingSecretHash: existing.pairingSecretHash,
        ...(existing.tokenHash === null ? {} : { tokenHash: existing.tokenHash }),
      };
    }

    const identity = createInstallationIdentity();
    const now = new Date().toISOString();
    const pairingSecretHash = hashPairingCredential(identity.pairingSecret);
    this.db.insert(installations).values({
      installationId: identity.installationId,
      pairingSecretHash,
      createdAt: now,
      updatedAt: now,
    }).run();
    return { ...identity, pairingSecretHash };
  }

  saveTokenHash(tokenHash: string): void {
    const existing = this.db.select().from(installations).get();
    if (existing === undefined) throw new Error("Installation is not initialized");
    this.db
      .update(installations)
      .set({ tokenHash, updatedAt: new Date().toISOString() })
      .where(eq(installations.installationId, existing.installationId))
      .run();
  }
}

