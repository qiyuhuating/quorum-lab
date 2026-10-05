import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile, appendFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';

const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const temporaryRoot = resolve(tmpdir());
const directory = await mkdtemp(join(temporaryRoot, 'quorum-portable-'));
const zip = resolve(`release/quorum-lab-v${version}-demo.zip`);
const python = process.platform === 'win32' ? 'python' : 'python3';
let server, verifier, startupTimer;
async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill();
  await exited;
}
try {
  execFileSync(python, ['-m', 'zipfile', '-e', zip, directory]);
  const demo = join(directory, 'quorum-lab-demo');
  server = spawn(process.execPath, ['serve.mjs', 'site'], {
    cwd: demo,
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let stderr = '';
  server.stderr.on('data', (data) => (stderr = (stderr + data).slice(-4096)));
  let failServer;
  const serverFailed = new Promise((_, reject) => {
    failServer = (error) => {
      reject(error);
      if (verifier && verifier.exitCode === null && verifier.signalCode === null) verifier.kill();
    };
  });
  // Observe failures even between readiness and starting the browser verifier.
  serverFailed.catch(() => {});
  server.once('error', failServer);
  server.once('exit', (code, signal) =>
    failServer(new Error(`Portable server exited (${signal ?? code}). ${stderr.trim()}`)),
  );
  startupTimer = setTimeout(
    () => failServer(new Error('Portable server did not report readiness within 10 seconds.')),
    10000,
  );
  const ready = new Promise((resolveReady) => {
    server.once('message', (message) => {
      if (
        message?.type !== 'quorum-ready' ||
        !/^http:\/\/127\.0\.0\.1:[1-9]\d*\/quorum-lab\/$/.test(message.url)
      ) {
        failServer(new Error('Portable server reported an invalid readiness message.'));
        return;
      }
      resolveReady(message.url);
    });
  });
  const url = await Promise.race([ready, serverFailed]);
  clearTimeout(startupTimer);
  // The verifier runs against the extracted bundle, not the workspace dist directory.
  verifier = spawn(process.execPath, ['scripts/verify-demo.mjs'], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      DEMO_URL: url,
      VALIDATION_OUTPUT: 'acceptance/portable',
    },
  });
  const code = await Promise.race([
    new Promise((resolveCode, reject) => {
      verifier.once('error', reject);
      verifier.once('exit', resolveCode);
    }),
    serverFailed,
  ]);
  if (code !== 0) throw new Error(`Extracted portable demo failed acceptance (${code}).`);
  for (const name of ['production', 'portable']) {
    const source = `acceptance/${name}/report.json`;
    const target = `release/${name}-validation.json`;
    await copyFile(source, target);
    const hash = createHash('sha256')
      .update(await readFile(target))
      .digest('hex');
    await appendFile('release/SHA256SUMS.txt', `${hash}  ${name}-validation.json\n`);
  }
} finally {
  clearTimeout(startupTimer);
  await stop(verifier);
  await stop(server);
  const target = resolve(directory);
  if (dirname(target) !== temporaryRoot || !basename(target).startsWith('quorum-portable-'))
    throw new Error('Refusing to clean a directory outside the created portable-test workspace.');
  await rm(target, { recursive: true, force: true });
}
