import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('CI checks the archive-free site with read-only build permissions', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  for (const check of ['npm ci', 'npm run check:ci', 'node scripts/check-browser.mjs', 'npm run test:funnel', 'node scripts/verify-preview-artifact.mjs']) assert.ok(workflow.includes(check), check);
  assert.match(workflow, /path: dist\//);
  const checkJob = workflow.split('\n  check:')[1].split('\n  deploy:')[0];
  assert.doesNotMatch(checkJob, /pages: write|id-token: write|deploy-pages/);
  assert.doesNotMatch(workflow, /pull_request_target|--prod|content\/downloads/);
  for (const action of workflow.matchAll(/uses: (\S+)/g)) assert.match(action[1], /@[0-9a-f]{40}$/);
});

test('regular Pages deployment requires passing CI, main, and explicit activation', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const deploy = workflow.split('\n  deploy:')[1];
  assert.ok(deploy, 'Pages deployment job must be prepared.');
  assert.match(deploy, /needs: check/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy, /github\.event_name != 'pull_request'/);
  assert.match(deploy, /vars\.PAGES_DEPLOYMENT_ENABLED == 'true'/);
  assert.match(deploy, /pages: write/);
  assert.match(deploy, /id-token: write/);
  assert.match(deploy, /name: github-pages/);
  assert.match(deploy, /actions\/deploy-pages@[0-9a-f]{40}/);
});
