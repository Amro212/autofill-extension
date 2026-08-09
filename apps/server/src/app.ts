import Fastify, { type FastifyInstance } from "fastify";

import { registerHealthRoute } from "./api/health.js";
import { registerPairingRoutes } from "./api/pair.js";
import type { PairingService } from "./auth/pairing.js";

export interface BuildAppOptions {
  pairingService: PairingService;
  logger?: boolean;
}

const extensionOrigin = /^(?:chrome|moz)-extension:\/\/[a-z0-9-]+$/i;

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: [
              "req.headers.authorization",
              "req.body.pairingSecret",
              "res.headers.authorization",
            ],
          },
  });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin !== undefined && !extensionOrigin.test(origin)) {
      return reply.code(403).send({
        error: {
          code: "BACKEND_UNPAIRED",
          message: "Request origin is not an extension",
        },
      });
    }
    if (origin !== undefined) {
      reply.header("access-control-allow-origin", origin);
      reply.header("vary", "Origin");
    }
  });

  registerHealthRoute(app);
  registerPairingRoutes(app, options.pairingService);
  return app;
}
