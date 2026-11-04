import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyPreviewArtifact(directory) {
  const root = resolve(directory);
  let pages = 0;
  const inspect = path => {
    const entry = lstatSync(path);
    assert.ok(!entry.isSymbolicLink(), 'Review artifacts must not contain symlinks.');
    if (entry.isDirectory()) {
      for (const name of readdirSync(path)) inspect(join(path, name));
      return;
    }
    assert.ok(entry.isFile(), 'Review artifacts must contain regular files only.');
    assert.ok(!/\.(zip|tar|gz|tgz|7z)$/i.test(path), 'Review artifact contains an archive.');
    const content = readFileSync(path, 'utf8');
    assert.doesNotMatch(content, /content\/downloads|"assetPath"|github\.com[/:]registrystack\/(?:registry-studio|breg-registry-starters)/i);
    if (path.endsWith('.html')) {
      pages++;
      assert.match(content, /<meta name="robots" content="noindex,nofollow"/);
      assert.doesNotMatch(content, /data-(?:endpoint|umami-script-src|umami-website-id)="[^\"]+"/, 'Review builds cannot include live form or analytics configuration.');
    }
  };
  inspect(root);
  assert.ok(pages > 0, 'Review artifact has no pages.');
  assert.match(readFileSync(join(root, 'robots.txt'), 'utf8'), /User-agent: \*\s+Disallow: \/\s*$/);
  return { pages };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyPreviewArtifact(process.argv[2] || new URL('../dist', import.meta.url).pathname);
  console.log(`Verified ${result.pages} review pages: no archives, private paths, live configuration, or indexable pages.`);
}
