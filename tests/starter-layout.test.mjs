import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogue } from '../src/lib/catalogue.mjs';
import { escapeHtml } from '../src/catalogue.js';
const readPage = id => readFileSync(new URL('../dist/packs/' + id + '/index.html', import.meta.url), 'utf8');

test('starter pages provide compact summaries and expandable complete record fields', () => {
  for (const starter of catalogue.starters) {
    const page = readPage(starter.id);
    assert.ok(page.includes('aria-label="On this page"'), starter.id);
    for (const type of starter.recordTypes) {
      const record = page.slice(page.indexOf('id="record-' + type.id + '"')).split('</article>')[0];
      assert.ok(record.includes('View ' + type.fields.length + ' fields'), starter.id + ': ' + type.id);
      for (const field of type.fields) assert.ok(record.includes(escapeHtml(field.id + ': ' + field.type)), starter.id + ': ' + field.id);
    }
    for (const action of starter.actions) assert.ok(page.includes(escapeHtml(action.id)));
    for (const profile of starter.accessProfiles) {
      assert.ok(page.includes(escapeHtml(profile.id)));
      for (const scope of profile.requiredScopes) assert.ok(page.includes(escapeHtml(scope)));
    }
    for (const key of starter.valuesKeys) assert.ok(page.includes(escapeHtml(key)));
  }
});
