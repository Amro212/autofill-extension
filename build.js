import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgPath = path.join(__dirname, 'package.json');
const distDir = path.join(__dirname, 'dist');
const cachePath = path.join(distDir, '.build-cache.json');
const srcDir = path.join(__dirname, 'src');

function readPackage() {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function writePackage(pkg) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function computeSourceHash() {
  const hash = crypto.createHash('sha256');

  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html'))) {
        hash.update(path.relative(__dirname, fullPath).replace(/\\/g, '/'));
        hash.update(fs.readFileSync(fullPath));
      }
    }
  }

  scan(srcDir);
  return hash.digest('hex');
}

function incrementVersion(version, type = 'patch') {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  let [major = 0, minor = 0, patch = 0] = parts;

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function getBuildCache() {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {}
  return null;
}

function saveBuildCache(hash, version) {
  try {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ hash, version, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch {}
}

function getBanner(pkg) {
  return `// ==UserScript==
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
}

function prepareVersion() {
  const pkg = readPackage();
  const currentHash = computeSourceHash();
  const cache = getBuildCache();

  // Check for explicit bump flag, e.g. --bump=minor or --bump=patch
  const bumpArg = process.argv.find((arg) => arg.startsWith('--bump='));
  const explicitBump = bumpArg ? bumpArg.split('=')[1] : null;

  if (explicitBump && ['major', 'minor', 'patch'].includes(explicitBump)) {
    const oldVersion = pkg.version;
    pkg.version = incrementVersion(oldVersion, explicitBump);
    writePackage(pkg);
    saveBuildCache(currentHash, pkg.version);
    console.log(`[build] Explicit version bump (${explicitBump}): ${oldVersion} -> ${pkg.version}`);
    return pkg;
  }

  // Automatic change detection
  const distFile = path.join(distDir, 'job-copilot.user.js');
  const hasExistingBundle = fs.existsSync(distFile);

  if (cache && cache.hash !== currentHash) {
    const oldVersion = pkg.version;
    pkg.version = incrementVersion(oldVersion, 'patch');
    writePackage(pkg);
    saveBuildCache(currentHash, pkg.version);
    console.log(`[build] Source changes detected. Version incremented: ${oldVersion} -> ${pkg.version}`);
    return pkg;
  }

  if (!cache || !hasExistingBundle) {
    saveBuildCache(currentHash, pkg.version);
    console.log(`[build] Build cache initialized at version ${pkg.version}`);
    return pkg;
  }

  console.log(`[build] No source changes detected. Current version: ${pkg.version}`);
  return pkg;
}

const isWatch = process.argv.includes('--watch');

async function run() {
  const pkg = prepareVersion();

  const buildOptions = {
    entryPoints: [path.join(__dirname, 'src', 'main.js')],
    outfile: path.join(__dirname, 'dist', 'job-copilot.user.js'),
    bundle: true,
    format: 'iife',
    banner: {
      js: getBanner(pkg),
    },
    define: {
      '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    sourcemap: false,
    minify: false,
    target: ['chrome100', 'firefox100'],
    legalComments: 'inline',
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log(`[build:watch] Watching for changes at version ${pkg.version}...`);
  } else {
    await esbuild.build(buildOptions);
    console.log(`[build] Built dist/job-copilot.user.js successfully (v${pkg.version}).`);
  }
}

run().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});
