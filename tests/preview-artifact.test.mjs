import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyPreviewArtifact } from '../scripts/verify-preview-artifact.mjs';

const fixture = () => {
  const path = mkdtempSync(join(tmpdir(), 'marketplace-artifact-test-'));
  mkdirSync(join(path, 'packs', 'sample'), { recursive: true });
  const html = '<meta name="robots" content="noindex,nofollow"><h1>Public catalogue</h1>';
  writeFileSync(join(path, 'index.html'), html);
  writeFileSync(join(path, 'packs', 'sample', 'index.html'), html);
  writeFileSync(join(path, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return path;
};
test('review artifact rejects archive bytes, live configuration, and indexable pages', () => {
  assert.equal(verifyPreviewArtifact(fixture()).pages, 2);
  const archive = fixture();
  writeFileSync(join(archive, 'starter.zip'), 'private bytes');
  assert.throws(() => verifyPreviewArtifact(archive), /archive/i);
  for (const unsafe of [
    '<meta name="robots" content="index,follow">',
    '<meta name="robots" content="noindex,nofollow"><form data-endpoint="https://forms.example.test/form/submit">',
    '<meta name="robots" content="noindex,nofollow"><div data-umami-website-id="configured">',
  ]) {
    const path = fixture();
    writeFileSync(join(path, 'index.html'), unsafe);
    assert.throws(() => verifyPreviewArtifact(path));
  }
});
