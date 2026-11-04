import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

// All canonical hosts below are intercepted. No production service receives a request.
const output = mkdtempSync(join(tmpdir(), 'marketplace-funnel-'));
execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', output], {
  env: { ...process.env, PUBLIC_STARTER_REQUEST_ENDPOINT: 'https://forms.example.test/form/submit?formId=1&privacy=kiosk', PUBLIC_UMAMI_WEBSITE_ID: '00000000-0000-4000-8000-000000000001', PUBLIC_UMAMI_SCRIPT_SRC: 'https://stats.example.test/script.js' },
  stdio: 'pipe',
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  const submissions = [];
  const unexpected = [];
  let failRequest = true;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === 'https://marketplace.registrystack.org') {
      const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      return route.fulfill({ body: readFileSync(join(output, path)), contentType: types[extname(path)] || 'text/plain' });
    }
    if (url.origin === 'https://stats.example.test') return route.fulfill({ contentType: 'text/javascript', body: 'window.__analytics=[];window.umami={track:(name,data)=>window.__analytics.push({name,data})};' });
    if (url.origin === 'https://fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.origin === 'https://registrystack.org' && url.pathname === '/tracking-bridge/') {
      return route.fulfill({ contentType: 'text/html', body: `<script>addEventListener('message',event=>{const request=event.data;if(request.protocol!=='registrystack-tracking'||request.version!==3)return;event.source.postMessage({protocol:request.protocol,version:3,id:request.id,ok:true,state:{choice:'rejected',generation:'00000000-0000-4000-8000-000000000002',expiresAt:Date.now()+86400000,revision:1}},event.origin)});</script>` });
    }
    if (url.origin === 'https://forms.example.test') {
      const data = new URLSearchParams(request.postData());
      submissions.push(data);
      const results = Object.fromEntries([...data].filter(([key]) => key.startsWith('mauticform[') && !['mauticform[formId]', 'mauticform[website]'].includes(key)).map(([key, value]) => [key.slice(11, -1), value]));
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://marketplace.registrystack.org' }, body: JSON.stringify(failRequest ? { success: 0 } : { success: 1, results }) });
    }
    unexpected.push(url.origin);
    return route.abort();
  });
  await page.goto('https://marketplace.registrystack.org/packs/professional-licensing/?secret=not-for-analytics');
  await page.waitForFunction(() => Boolean(window.umami));
  await page.locator('[data-request-access]').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByLabel('Email address').fill('reader@example.test');
  await dialog.getByLabel('Organization').fill('Example institution');
  await dialog.getByLabel('What are you trying to do?').fill('Synthetic test context');
  await dialog.getByRole('button', { name: 'Send request', exact: true }).click();
  await dialog.locator('[data-pack-request-error]').waitFor({ state: 'visible' });
  assert.equal(await dialog.getByLabel('Email address').inputValue(), 'reader@example.test');
  assert.equal(await page.evaluate(() => window.__analytics.filter(event => event.data.action === 'request_submitted').length), 0);
  failRequest = false;
  await dialog.getByRole('button', { name: 'Send request', exact: true }).click();
  await dialog.locator('[data-pack-request-success]').waitFor({ state: 'visible' });
  const events = await page.evaluate(() => window.__analytics);
  assert.deepEqual(events.map(event => event.data.action), ['download_intent', 'request_submitted']);
  for (const event of events) {
    assert.equal(event.data.pack, 'professional-licensing');
    assert.equal(event.data.source_path, '/packs/professional-licensing/');
    assert.doesNotMatch(JSON.stringify(event), /reader@|Synthetic test|Example institution|secret/);
  }
  assert.equal(submissions.length, 2);
  assert.ok(submissions.every(data => !data.has('mautic_device_id')));
  assert.equal(submissions[1].get('mauticform[source_page]'), 'https://marketplace.registrystack.org/packs/professional-licensing/');
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  console.log('PASS: mocked request popup, failed-request retention, confirmed submission, separate intent/submission analytics, no visitor data in analytics, no production network.');
} finally {
  await browser.close();
}
