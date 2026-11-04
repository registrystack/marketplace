import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('CI checks the archive-free site and publishes only a checked review artifact', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  for (const check of ['npm ci', 'npm run check:ci', 'node scripts/check-browser.mjs', 'npm run test:funnel', 'node scripts/verify-preview-artifact.mjs']) assert.ok(workflow.includes(check), check);
  assert.match(workflow, /path: dist\//);
  assert.doesNotMatch(workflow, /pull_request_target|pages: write|id-token: write|deploy-pages|--prod|content\/downloads/);
  for (const action of workflow.matchAll(/uses: (\S+)/g)) assert.match(action[1], /@[0-9a-f]{40}$/);
});
