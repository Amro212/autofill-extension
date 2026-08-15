import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const BANNER = `// ==UserScript==
// @name         Job Copilot
// @namespace    https://github.com/Amro212/autofill-extension
// @version      ${pkg.version}
// @description  ${pkg.description}
// @author       ${pkg.author}
// @match        *://*/*
// @connect      openrouter.ai
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==
`;

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'src', 'main.js')],
  outfile: path.join(__dirname, 'dist', 'job-copilot.user.js'),
  bundle: true,
  format: 'iife',
  banner: {
    js: BANNER,
  },
  sourcemap: false,
  minify: false,
  target: ['chrome100', 'firefox100'],
  legalComments: 'inline',
};

async function run() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[build] Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('[build] Built dist/job-copilot.user.js successfully.');
  }
}

run().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});
