import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface PairingServiceOptions {
  installationId: string;
  pairingSecret: string;
}

export interface PersistedPairingState {
  installationId: string;
  pairingSecretHash: string;
  tokenHash?: string;
}

export interface PersistedPairingServiceOptions extends PersistedPairingState {
  saveTokenHash?: (tokenHash: string) => void;
}

export interface PairingResult {
  installationId: string;
  token: string;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hashPairingCredential(value: string): string {
  return digest(value).toString("hex");
}

function secureEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export class PairingService {
  readonly installationId: string;
  readonly #pairingSecretHash: Buffer;
  #tokenHash: Buffer | undefined;
  readonly #saveTokenHash: ((tokenHash: string) => void) | undefined;

  constructor(options: PairingServiceOptions | PersistedPairingServiceOptions) {
    this.installationId = options.installationId;
    if ("pairingSecretHash" in options) {
      this.#pairingSecretHash = Buffer.from(options.pairingSecretHash, "hex");
      this.#tokenHash =
        options.tokenHash === undefined
          ? undefined
          : Buffer.from(options.tokenHash, "hex");
      this.#saveTokenHash = options.saveTokenHash;
    } else {
      this.#pairingSecretHash = digest(options.pairingSecret);
      this.#saveTokenHash = undefined;
    }
  }

  static fromPersisted(options: PersistedPairingServiceOptions): PairingService {
    return new PairingService(options);
  }

  pair(pairingSecret: string): PairingResult {
    if (!secureEqual(digest(pairingSecret), this.#pairingSecretHash)) {
      throw new Error("Invalid pairing secret");
    }

    const token = randomBytes(32).toString("base64url");
    this.#tokenHash = digest(token);
    this.#saveTokenHash?.(this.#tokenHash.toString("hex"));
    return { installationId: this.installationId, token };
  }

  verifyToken(token: string): boolean {
    return this.#tokenHash !== undefined && secureEqual(digest(token), this.#tokenHash);
  }
}
