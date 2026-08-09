import Fastify, { type FastifyInstance } from "fastify";

import { registerDocumentRoutes } from "./api/documents.js";
import { registerApplicationRoutes } from "./api/applications.js";
import { registerHealthRoute } from "./api/health.js";
import { registerJobRoutes } from "./api/jobs.js";
import { registerPairingRoutes } from "./api/pair.js";
import { registerProfileRoutes } from "./api/profile.js";
import { registerSettingsRoutes } from "./api/settings.js";
import type { PairingService } from "./auth/pairing.js";
import type { DocumentImportService } from "./documents/import.js";
import type { ApplicationRepository } from "./repositories/applications.js";
import type { JobRepository } from "./repositories/jobs.js";
import type { ProfileRepository } from "./repositories/profile.js";
import type { SettingsRepository } from "./repositories/settings.js";

export interface BuildAppOptions {
  pairingService: PairingService;
  documentService?: DocumentImportService;
  applicationRepository?: ApplicationRepository;
  jobRepository?: JobRepository;
  profileRepository?: ProfileRepository;
  settingsRepository?: SettingsRepository;
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
  if (options.jobRepository !== undefined) {
    registerJobRoutes(app, options.pairingService, options.jobRepository);
  }
  if (options.applicationRepository !== undefined) {
    registerApplicationRoutes(
      app,
      options.pairingService,
      options.applicationRepository,
    );
  }
  if (options.documentService !== undefined) {
    registerDocumentRoutes(app, options.pairingService, options.documentService);
  }
  if (options.profileRepository !== undefined) {
    registerProfileRoutes(app, options.pairingService, options.profileRepository);
  }
  if (options.settingsRepository !== undefined) {
    registerSettingsRoutes(app, options.pairingService, options.settingsRepository);
  }
  return app;
}
