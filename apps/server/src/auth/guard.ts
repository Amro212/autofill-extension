import type { FastifyReply, FastifyRequest } from "fastify";

import type { PairingService } from "./pairing.js";

function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
}

export function createAuthGuard(pairingService: PairingService) {
  return async function authGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = readBearerToken(request.headers.authorization);
    if (token === null || !pairingService.verifyToken(token)) {
      await reply.code(401).send({
        error: {
          code: "BACKEND_UNPAIRED",
          message: "Pair extension before continuing",
        },
      });
    }
  };
}
