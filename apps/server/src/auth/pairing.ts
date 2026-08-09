import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface PairingServiceOptions {
  installationId: string;
  pairingSecret: string;
}

export interface PairingResult {
  installationId: string;
  token: string;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function secureEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

export class PairingService {
  readonly installationId: string;
  readonly #pairingSecretHash: Buffer;
  #tokenHash: Buffer | undefined;

  constructor(options: PairingServiceOptions) {
    this.installationId = options.installationId;
    this.#pairingSecretHash = digest(options.pairingSecret);
  }

  pair(pairingSecret: string): PairingResult {
    if (!secureEqual(digest(pairingSecret), this.#pairingSecretHash)) {
      throw new Error("Invalid pairing secret");
    }

    const token = randomBytes(32).toString("base64url");
    this.#tokenHash = digest(token);
    return { installationId: this.installationId, token };
  }

  verifyToken(token: string): boolean {
    return this.#tokenHash !== undefined && secureEqual(digest(token), this.#tokenHash);
  }
}
