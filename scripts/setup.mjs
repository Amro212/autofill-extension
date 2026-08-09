import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, ".env");
const example = resolve(root, ".env.example");
const dataDirectory = resolve(root, "data");

mkdirSync(dataDirectory, { recursive: true });
if (!existsSync(envFile)) copyFileSync(example, envFile);

if (stdin.isTTY) {
  const prompt = createInterface({ input: stdin, output: stdout });
  await prompt.question("Job Copilot local files are ready. Press Enter for next steps. ");
  prompt.close();
}

stdout.write([
  `Configuration: ${envFile}`,
  `Private data: ${dataDirectory}`,
  "1. Edit .env; choose mock or openrouter and add OPENROUTER_API_KEY if needed.",
  "2. Run: pnpm dev:server",
  "3. Run: pnpm --filter @job-copilot/extension build",
  "4. Load apps/extension/.output/chrome-mv3 as an unpacked extension.",
  "5. Enter the one-time pairing secret printed by the server.",
  "",
].join("\n"));
