import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";

const STORAGE_KEY = /^[0-9a-f-]{36}\.blob$/;

export function sanitizeDocumentFilename(filename: string): string {
  const leaf = filename.replaceAll("\\", "/").split("/").at(-1) ?? "";
  const withoutControls = [...leaf.normalize("NFKC")]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
  const cleaned = withoutControls
    .replace(/[<>:"|?*]/g, "")
    .replace(/[. ]+$/g, "")
    .trim();
  return cleaned === "" ? "document" : cleaned.slice(0, 200);
}

export class DocumentStorage {
  readonly #root: string;

  constructor(root: string) {
    this.#root = resolve(root);
    mkdirSync(this.#root, { recursive: true, mode: 0o700 });
  }

  store(bytes: Buffer): string {
    const key = `${randomUUID()}.blob`;
    writeFileSync(this.#resolveKey(key), bytes, { flag: "wx", mode: 0o600 });
    return key;
  }

  read(key: string): Buffer {
    return readFileSync(this.#resolveKey(key));
  }

  delete(key: string): void {
    rmSync(this.#resolveKey(key), { force: true });
  }

  #resolveKey(key: string): string {
    if (!STORAGE_KEY.test(key)) throw new Error("Invalid storage key");
    const path = resolve(this.#root, key);
    const child = relative(this.#root, path);
    if (child.startsWith("..") || resolve(path) === this.#root) {
      throw new Error("Storage path escapes configured root");
    }
    return path;
  }
}
