import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from '@astrojs/compiler';

import {
  packRequestEndpoint,
  packRequestRecoveryHref,
  packRequestSourcePage,
  submitPackRequest,
} from '../src/lib/pack-request.ts';

const endpoint = 'https://forms.example.test/form/submit?formId=7&privacy=kiosk';
const requestId = '00000000-0000-4000-8000-000000000007';
const input = {
  email: 'reader@example.test',
  organization: 'Example ministry',
  role: 'Service owner',
  message: 'We are assessing this pack.',
  website: '',
  packId: 'professional-licensing',
  packTitle: 'Professional licensing starter',
  sourcePage: 'https://marketplace.registrystack.org/packs/professional-licensing/',
};

test('accepts only an exact HTTPS kiosk form endpoint', () => {
  assert.equal(packRequestEndpoint(undefined), undefined);
  assert.equal(packRequestEndpoint(endpoint), endpoint);
  for (const value of [
    'http://forms.example.test/form/submit?formId=7&privacy=kiosk',
    'https://person:secret@forms.example.test/form/submit?formId=7&privacy=kiosk',
    'https://forms.example.test/form/submit?formId=7&privacy=consented',
    'https://forms.example.test/form/submit?formId=7&privacy=kiosk&token=private',
    'https://forms.example.test/form/submit?formId=7&privacy=kiosk#result',
    'https://forms.example.test/other?formId=7&privacy=kiosk',
  ]) assert.throws(() => packRequestEndpoint(value), /pack request form endpoint/i);
});

test('accepts only exact canonical marketplace source pages', () => {
  assert.equal(packRequestSourcePage(input.sourcePage), input.sourcePage);
  assert.equal(
    packRequestSourcePage('https://marketplace.registrystack.org/collections/licensing/'),
    'https://marketplace.registrystack.org/collections/licensing/',
  );
  for (const value of [
    '/packs/professional-licensing/',
    'https://marketplace.registrystack.org/packs/professional-licensing/?email=private',
    'https://marketplace.registrystack.org/packs/professional-licensing/#request',
    ' https://marketplace.registrystack.org/packs/professional-licensing/',
    'https://marketplace.registrystack.org/packs/other/../professional-licensing/',
    'https://evil.example/packs/professional-licensing/',
    'https://marketplace.registrystack.org/private/person@example.test/',
  ]) assert.equal(packRequestSourcePage(value), undefined);
});

test('submits the unlinked native form and confirms every saved field', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    const body = Object.fromEntries(options.body);
    return new Response(JSON.stringify({
      success: 1,
      results: {
        email: body['mauticform[email]'],
        organization: body['mauticform[organization]'],
        role: body['mauticform[role]'],
        message: body['mauticform[message]'],
        starter_id: body['mauticform[starter_id]'],
        source_page: body['mauticform[source_page]'],
        request_token: body['mauticform[request_token]'],
        request_type: body['mauticform[request_type]'],
        request_context: body['mauticform[request_context]'],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  await submitPackRequest(endpoint, input, { fetch: fakeFetch, randomUUID: () => requestId });
  assert.equal(calls.length, 1);
  const [{ url, options }] = calls;
  assert.equal(url, `${endpoint}&ajax=1`);
  assert.doesNotMatch(url, /reader|professional-licensing|request_token|mautic_device_id/);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.referrerPolicy, 'no-referrer');
  const body = Object.fromEntries(options.body);
  assert.deepEqual(body, {
    'mauticform[email]': input.email,
    'mauticform[organization]': input.organization,
    'mauticform[role]': input.role,
    'mauticform[message]': input.message,
    'mauticform[starter_id]': input.packId,
    'mauticform[source_page]': input.sourcePage,
    'mauticform[request_token]': requestId,
    'mauticform[request_type]': 'starter',
    'mauticform[request_context]': input.packTitle,
    'mauticform[website]': '',
    'mauticform[formId]': '7',
  });
  assert.equal(Object.hasOwn(body, 'mautic_device_id'), false);
});

test('rejects malformed input, honeypots, false success, and unconfirmed fields', async () => {
  const neverCalled = async () => { throw new Error('fetch should not run'); };
  for (const invalid of [
    { ...input, email: 'not-an-email' },
    { ...input, organization: 'x'.repeat(201) },
    { ...input, role: 'x'.repeat(201) },
    { ...input, message: 'x'.repeat(2001) },
    { ...input, website: 'bot.example' },
    { ...input, packId: 'person@example.test' },
    { ...input, packTitle: 'x'.repeat(201) },
    { ...input, sourcePage: `${input.sourcePage}?token=private` },
  ]) await assert.rejects(
    submitPackRequest(endpoint, invalid, { fetch: neverCalled, randomUUID: () => requestId }),
    /check the request details/i,
  );

  for (const response of [
    new Response('saved', { status: 200, headers: { 'content-type': 'text/plain' } }),
    new Response(JSON.stringify({ success: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify({ success: 1, results: { email: input.email } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    new Response(JSON.stringify({ success: 1, validationErrors: {}, results: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ]) await assert.rejects(
    submitPackRequest(endpoint, input, {
      fetch: async () => response.clone(),
      randomUUID: () => requestId,
    }),
    /could not confirm/i,
  );
});

test('times out without reporting a fake success', async () => {
  await assert.rejects(
    submitPackRequest(endpoint, input, {
      fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
      randomUUID: () => requestId,
      timeoutMs: 5,
    }),
    error => error?.name === 'TimeoutError',
  );
});

test('renders a native dialog, honest fallback, local gate, and success-only aggregate event', async () => {
  const source = await readFile(new URL('../src/components/PackRequestDialog.astro', import.meta.url), 'utf8');
  await transform(source);
  assert.match(source, /<dialog[^>]+id="mp-request-dialog"/);
  assert.match(source, /aria-labelledby="mp-request-dialog-title"/);
  assert.match(source, /\[data-request-access\]/);
  assert.match(source, /window\.location\.origin === 'https:\/\/marketplace\.registrystack\.org'/);
  assert.match(source, /PUBLIC_STARTER_REQUEST_ENDPOINT/);
  assert.match(source, /The request form is currently unavailable/);
  assert.match(source, /Local preview: requests are not sent/);
  assert.match(source, /data-pack-request-email/);
  assert.match(source, /data-pack-request-submit[\s\S]*?disabled/);
  assert.match(source, /activeTrigger\?\.focus\(\)/);
  assert.match(source, /controller\.signal\.aborted[\s\S]*?fieldset\.disabled = false/);
  assert.match(source, /packRequestRecoveryHref/);
  assert.match(source, /Email contact@registrystack\.org/);
  assert.match(source, /await submitPackRequest/);
  assert.match(source, /marketplaceAction: 'request_submitted'/);
  assert.doesNotMatch(source, /associate\(|deviceId|mautic_device_id|request_token/);
  const successfulHook = source.match(/await submitPackRequest[\s\S]*?marketplaceAction: 'request_submitted'/);
  assert.ok(successfulHook, 'Success analytics must occur only after a confirmed native result.');
});

test('fallback email contains public pack context but no visitor data', () => {
  const href = packRequestRecoveryHref(input.packTitle);
  assert.match(href, /^mailto:contact@registrystack\.org\?/);
  assert.match(decodeURIComponent(href), /Professional licensing starter/);
  assert.doesNotMatch(decodeURIComponent(href), /reader@example|Example ministry|Service owner/);
});
