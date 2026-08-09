import { randomBytes, randomUUID } from "node:crypto";

export interface InstallationIdentity {
  installationId: string;
  pairingSecret: string;
}

export function createInstallationIdentity(): InstallationIdentity {
  return {
    installationId: randomUUID(),
    pairingSecret: randomBytes(32).toString("base64url"),
  };
}
