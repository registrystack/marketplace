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
  const checkJob = workflow.split('\n  check:')[1].split('\n  production:')[0];
  assert.doesNotMatch(checkJob, /pages: write|id-token: write|deploy-pages/);
  assert.doesNotMatch(workflow, /pull_request_target|content\/downloads/);
  for (const action of workflow.matchAll(/uses: (\S+)/g)) assert.match(action[1], /@[0-9a-f]{40}$/);
});

test('regular Pages deployment requires passing CI, main, and explicit activation', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const check = workflow.split('\n  check:')[1].split('\n  production:')[0];
  const production = workflow.split('\n  production:')[1].split('\n  deploy:')[0];
  const deploy = workflow.split('\n  deploy:')[1];
  assert.ok(production, 'A separate production build job must be prepared.');
  assert.ok(deploy, 'Pages deployment job must be prepared.');
  assert.match(production, /needs: check/);
  assert.match(production, /github\.ref == 'refs\/heads\/main'/);
  assert.match(production, /github\.event_name != 'pull_request'/);
  assert.match(production, /vars\.PAGES_DEPLOYMENT_ENABLED == 'true'/);
  assert.match(production, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(production, /persist-credentials: false/);
  assert.match(production, /npm ci/);
  assert.match(production, /npm run build/);
  assert.match(production, /node scripts\/verify-preview-artifact\.mjs --production/);
  assert.match(production, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.ok(
    production.indexOf('node scripts/verify-preview-artifact.mjs --production')
      < production.indexOf('actions/upload-pages-artifact@'),
    'Production verification must finish before the Pages artifact is uploaded.',
  );
  assert.match(production, /PUBLIC_UMAMI_WEBSITE_ID: \$\{\{ vars\.PUBLIC_UMAMI_WEBSITE_ID \}\}/);
  assert.match(production, /PUBLIC_UMAMI_SCRIPT_SRC: \$\{\{ vars\.PUBLIC_UMAMI_SCRIPT_SRC \}\}/);
  assert.match(production, /PUBLIC_STARTER_REQUEST_ENDPOINT: \$\{\{ vars\.PUBLIC_STARTER_REQUEST_ENDPOINT \}\}/);
  assert.match(production, /PUBLIC_SHARED_TRACKING_ENABLED: \$\{\{ vars\.PUBLIC_SHARED_TRACKING_ENABLED \}\}/);
  assert.doesNotMatch(check, /vars\.PUBLIC_(?:UMAMI|STARTER|SHARED)/);
  assert.doesNotMatch(check, /upload-pages-artifact/);
  assert.match(deploy, /needs: production/);
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy, /github\.event_name != 'pull_request'/);
  assert.match(deploy, /vars\.PAGES_DEPLOYMENT_ENABLED == 'true'/);
  assert.match(deploy, /pages: write/);
  assert.match(deploy, /id-token: write/);
  assert.match(deploy, /name: github-pages/);
  assert.match(deploy, /actions\/deploy-pages@[0-9a-f]{40}/);
});
