export interface UploadOptions {
  createDataTransfer?: () => DataTransfer;
  acceptedState?: () => boolean;
  timeoutMs?: number;
}

export type UploadResult =
  | { ok: true; filename: string }
  | {
      ok: false;
      reason:
        | "file-type-not-accepted"
        | "data-transfer-unavailable"
        | "assignment-failed"
        | "verification-failed";
    };

function accepts(input: HTMLInputElement, file: File): boolean {
  const rules = input.accept
    .split(",")
    .map((rule) => rule.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLocaleLowerCase();
  const type = file.type.toLocaleLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith(".")) return name.endsWith(rule);
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function assignFiles(input: HTMLInputElement, files: FileList): boolean {
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files")?.set;
    if (setter !== undefined) setter.call(input, files);
    else Object.defineProperty(input, "files", { configurable: true, value: files });
    return input.files?.[0] === files[0];
  } catch {
    try {
      Object.defineProperty(input, "files", { configurable: true, value: files });
      return input.files?.[0] === files[0];
    } catch {
      return false;
    }
  }
}

export async function uploadFile(
  input: HTMLInputElement,
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  if (!accepts(input, file)) return { ok: false, reason: "file-type-not-accepted" };
  let transfer: DataTransfer;
  try {
    transfer = options.createDataTransfer?.() ?? new DataTransfer();
  } catch {
    return { ok: false, reason: "data-transfer-unavailable" };
  }
  transfer.items.add(file);
  if (!assignFiles(input, transfer.files)) {
    return { ok: false, reason: "assignment-failed" };
  }
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  const deadline = Date.now() + (options.timeoutMs ?? 1_000);
  do {
    const assigned = input.files?.[0]?.name === file.name;
    if (assigned && (options.acceptedState?.() ?? true)) {
      return { ok: true, filename: file.name };
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  } while (Date.now() <= deadline);
  return { ok: false, reason: "verification-failed" };
}
