import {
  applicationCreateSchema,
  applicationTransitionSchema,
} from "@job-copilot/contracts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import type { ApplicationRepository } from "../repositories/applications.js";

const tabParamsSchema = z.object({ tabId: z.coerce.number().int().nonnegative() });
const idParamsSchema = z.object({ id: z.string().uuid() });

export function registerApplicationRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  applications: ApplicationRepository,
): void {
  const preHandler = createAuthGuard(pairingService);
  app.post("/v1/applications", { preHandler }, async (request, reply) => {
    const parsed = applicationCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_FAILED", message: "Invalid application session" },
      });
    }
    return reply.code(201).send(applications.create(parsed.data));
  });
  app.get(
    "/v1/applications/by-tab/:tabId",
    { preHandler },
    async (request, reply) => {
      const parsed = tabParamsSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send();
      const session = applications.findByTab(parsed.data.tabId);
      return session === undefined ? reply.code(404).send() : session;
    },
  );
  app.get("/v1/applications/:id", { preHandler }, async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send();
    const session = applications.get(parsed.data.id);
    return session === undefined ? reply.code(404).send() : session;
  });
  app.patch("/v1/applications/:id/state", { preHandler }, async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const body = applicationTransitionSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_FAILED", message: "Invalid state transition" },
      });
    }
    try {
      const session = applications.transition(params.data.id, body.data.state);
      return session === undefined ? reply.code(404).send() : session;
    } catch {
      return reply.code(409).send({
        error: { code: "ILLEGAL_STATE_TRANSITION", message: "Illegal application transition" },
      });
    }
  });
}
