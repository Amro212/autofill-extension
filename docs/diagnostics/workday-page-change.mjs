// Maintained regressions replacing the original current-bug reproduction.
// Run: node docs/diagnostics/workday-page-change.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, [
  '--test', '--test-name-pattern',
  'same-step|conditional|heading-only|Resume after|question changed|markerless|legacy workflow|late request|dynamic field|real transition|baseline disabled|duplicate field IDs revealed|full reload after|failed primary retry|Workday language|temporarily disabled dependent',
  'tests/application.test.js',
], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
