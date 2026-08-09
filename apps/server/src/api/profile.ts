import { applicantProfileUpdateSchema } from "@job-copilot/contracts";
import type { FastifyInstance } from "fastify";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import type { ProfileRepository } from "../repositories/profile.js";

export function registerProfileRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  profiles: ProfileRepository,
): void {
  const preHandler = createAuthGuard(pairingService);
  app.get("/v1/profile", { preHandler }, async () => profiles.get());
  app.patch("/v1/profile", { preHandler }, async (request, reply) => {
    const parsed = applicantProfileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid applicant profile",
        },
      });
    }
    return profiles.update(parsed.data);
  });
}

