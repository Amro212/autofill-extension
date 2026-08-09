import { cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(process.argv[2] ?? resolve(root, "data"));
if (!existsSync(source)) throw new Error(`Data directory does not exist: ${source}`);
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = resolve(process.argv[3] ?? resolve(root, "backups", `job-copilot-${stamp}`));
mkdirSync(resolve(destination, ".."), { recursive: true });
cpSync(source, destination, { recursive: true, errorOnExist: true });
process.stdout.write(`Backed up ${basename(source)} to ${destination}\n`);
