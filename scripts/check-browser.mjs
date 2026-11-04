import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

try {
  const origin = await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser test server did not become ready.')), 10000);
    const finish = callback => value => { clearTimeout(timeout); callback(value); };
    server.once('error', finish(reject));
    server.once('exit', finish(code => reject(new Error('Browser test server exited: ' + code))));
    server.stdout.setEncoding('utf8');
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Local: (http:\/\/127\.0\.0\.1:[1-9][0-9]*)\s/);
      if (match) finish(resolveReady)(match[1]);
    });
  });
  const response = await fetch(origin, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Browser test server failed its readiness check.');
  const child = spawn(process.execPath, ['tests/browser.mjs'], {
    cwd: root,
    env: { ...process.env, MARKETPLACE_URL: origin },
    stdio: 'inherit',
  });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('Marketplace browser checks failed: ' + code);
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
