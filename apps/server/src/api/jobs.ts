import { jobCaptureSchema } from "@job-copilot/contracts";
import type { FastifyInstance } from "fastify";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import type { JobRepository } from "../repositories/jobs.js";

export function registerJobRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  jobs: JobRepository,
): void {
  const preHandler = createAuthGuard(pairingService);
  app.get("/v1/jobs", { preHandler }, async () => jobs.list());
  app.post("/v1/jobs", { preHandler }, async (request, reply) => {
    const parsed = jobCaptureSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_FAILED", message: "Invalid job capture" },
      });
    }
    return reply.code(201).send(jobs.create(parsed.data));
  });
}

