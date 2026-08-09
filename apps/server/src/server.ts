import type { InstallationIdentity } from "./auth/installation.js";
import { pathToFileURL } from "node:url";
import { createInstallationIdentity } from "./auth/installation.js";
import { PairingService } from "./auth/pairing.js";
import { buildApp } from "./app.js";

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

export async function startServer(
  env: NodeJS.ProcessEnv = process.env,
  identity: InstallationIdentity = createInstallationIdentity(),
): Promise<void> {
  const pairingService = new PairingService(identity);
  const app = buildApp({ pairingService });
  const address = await app.listen(resolveServerConfig(env));

  app.log.info({ address, installationId: identity.installationId }, "Job Copilot ready");
  process.stderr.write(`Pairing secret: ${identity.pairingSecret}\n`);
}

if (isMainModule(process.argv[1], import.meta.url)) {
  startServer().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
