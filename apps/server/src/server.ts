import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveAiProviderConfig } from "./ai/config.js";
import { MockProvider } from "./ai/mock-provider.js";
import { OpenRouterProvider } from "./ai/openrouter-provider.js";
import { AiService } from "./ai/service.js";
import { PairingService } from "./auth/pairing.js";
import { buildApp } from "./app.js";
import { openDatabase } from "./db/client.js";
import { migrateDatabase } from "./db/migrate.js";
import { DocumentImportService } from "./documents/import.js";
import { DocumentStorage } from "./documents/storage.js";
import { AnswerMemoryRepository } from "./memory/repository.js";
import { DocumentRepository } from "./repositories/documents.js";
import { ApplicationRepository } from "./repositories/applications.js";
import { AnswerRecordRepository } from "./repositories/answers.js";
import { JobRepository } from "./repositories/jobs.js";
import { InstallationRepository } from "./repositories/installation.js";
import { ProfileRepository } from "./repositories/profile.js";
import { SettingsRepository } from "./repositories/settings.js";

export interface ServerConfig {
  host: string;
  port: number;
}

export function isMainModule(
  entryPath: string | undefined,
  moduleUrl: string,
): boolean {
  return entryPath !== undefined && pathToFileURL(entryPath).href === moduleUrl;
}

export function resolveServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const host = env.JOB_COPILOT_HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error("JOB_COPILOT_HOST must be a loopback address");
  }

  const port = Number(env.JOB_COPILOT_PORT ?? 4317);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("JOB_COPILOT_PORT must be an integer from 0 to 65535");
  }
  return { host, port };
}

export function resolveDataDirectory(
  env: NodeJS.ProcessEnv,
  currentDirectory = process.cwd(),
): string {
  return resolve(currentDirectory, env.JOB_COPILOT_DATA_DIR ?? "data");
}

export function createServerRuntime(env: NodeJS.ProcessEnv = process.env) {
  const dataDirectory = resolveDataDirectory(env);
  const connection = openDatabase(join(dataDirectory, "job-copilot.sqlite"));
  migrateDatabase(connection);
  const installations = new InstallationRepository(connection.db);
  const bootstrap = installations.getOrCreate();
  const pairingService = PairingService.fromPersisted({
    ...bootstrap,
    saveTokenHash: (tokenHash) => installations.saveTokenHash(tokenHash),
  });
  const documentService = new DocumentImportService(
    new DocumentStorage(join(dataDirectory, "uploads")),
    new DocumentRepository(connection.db),
  );
  const settingsRepository = new SettingsRepository(connection.db);
  const profileRepository = new ProfileRepository(connection.db);
  const jobRepository = new JobRepository(connection.db);
  const applicationRepository = new ApplicationRepository(
    connection.db,
    settingsRepository,
  );
  const memoryRepository = new AnswerMemoryRepository(connection.db);
  const aiConfig = resolveAiProviderConfig(env);
  const aiProvider =
    aiConfig.kind === "openrouter"
      ? new OpenRouterProvider(aiConfig)
      : new MockProvider();
  const app = buildApp({
    applicationRepository,
    ai: {
      service: new AiService(aiProvider),
      profiles: profileRepository,
      applications: applicationRepository,
      jobs: jobRepository,
      memories: memoryRepository,
      answers: new AnswerRecordRepository(connection.db),
    },
    documentService,
    jobRepository,
    pairingService,
    profileRepository,
    settingsRepository,
  });
  app.addHook("onClose", () => connection.close());
  return {
    app,
    pairingService,
    installationId: bootstrap.installationId,
    ...(bootstrap.pairingSecret === undefined
      ? {}
      : { pairingSecret: bootstrap.pairingSecret }),
    close: () => app.close(),
  };
}

export async function startServer(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const runtime = createServerRuntime(env);
  const { app } = runtime;
  const address = await app.listen(resolveServerConfig(env));

  app.log.info(
    { address, installationId: runtime.installationId },
    "Job Copilot ready",
  );
  if (runtime.pairingSecret !== undefined) {
    process.stderr.write(`Pairing secret: ${runtime.pairingSecret}\n`);
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  startServer().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
