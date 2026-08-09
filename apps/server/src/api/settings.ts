import { automationSettingsUpdateSchema } from "@job-copilot/contracts";
import type { FastifyInstance } from "fastify";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import type { SettingsRepository } from "../repositories/settings.js";

export function registerSettingsRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  settings: SettingsRepository,
): void {
  const preHandler = createAuthGuard(pairingService);
  app.get("/v1/settings", { preHandler }, async () => settings.get());
  app.patch("/v1/settings", { preHandler }, async (request, reply) => {
    const parsed = automationSettingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid automation settings",
        },
      });
    }
    return settings.update(parsed.data);
  });
}

