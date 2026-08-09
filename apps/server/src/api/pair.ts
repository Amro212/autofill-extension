import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";

const pairRequestSchema = z.object({ pairingSecret: z.string().min(1) });

export function registerPairingRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
): void {
  app.post("/v1/pair", async (request, reply) => {
    const parsed = pairRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "BACKEND_UNPAIRED", message: "Invalid pairing request" },
      });
    }

    try {
      return pairingService.pair(parsed.data.pairingSecret);
    } catch {
      return reply.code(401).send({
        error: { code: "BACKEND_UNPAIRED", message: "Invalid pairing secret" },
      });
    }
  });

  app.get(
    "/v1/auth/status",
    { preHandler: createAuthGuard(pairingService) },
    async () => ({ paired: true }),
  );
}
