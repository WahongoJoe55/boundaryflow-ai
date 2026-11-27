import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'tests', 'engine-regression-runner.html'), 'utf8');
const matrix = fs.readFileSync(path.join(root, 'tests', 'ENGINE_REGRESSION_MATRIX.md'), 'utf8');
const caseArray = runner.match(/const\s+cases\s*=\s*\[([\s\S]*?)\n\];/);
if (!caseArray) throw new Error('Could not locate the executable regression case array.');
const runnerIds = [...caseArray[1].matchAll(/\bid\s*:\s*['"](BF-[A-Z0-9-]+)['"]/g)].map(match => match[1]);
const matrixIds = [...matrix.matchAll(/^\|\s*(BF-[A-Z0-9-]+)\s*\|/gm)].map(match => match[1]);
function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].filter(([, n]) => n > 1).map(([id, n]) => id + ' (' + n + ')');
}
const duplicateRunnerIds = duplicates(runnerIds);
const duplicateMatrixIds = duplicates(matrixIds);
const runnerSet = new Set(runnerIds);
const matrixSet = new Set(matrixIds);
const missingFromMatrix = [...runnerSet].filter(id => !matrixSet.has(id));
const matrixOnly = [...matrixSet].filter(id => !runnerSet.has(id));
console.log(JSON.stringify({
  runnerTotal: runnerIds.length,
  runnerUnique: runnerSet.size,
  matrixTotal: matrixIds.length,
  matrixUnique: matrixSet.size,
  duplicateRunnerIds,
  duplicateMatrixIds,
  missingFromMatrix,
  matrixOnly
}, null, 2));
if (!runnerIds.length || duplicateRunnerIds.length || duplicateMatrixIds.length ||
    missingFromMatrix.length || matrixOnly.length || runnerIds.length !== matrixIds.length) {
  console.error('Regression runner/matrix integrity check failed.');
  process.exitCode = 1;
} else {
  console.log('PASS: every executable regression scenario has exactly one matching matrix row.');
}
