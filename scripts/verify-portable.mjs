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
let server;
try {
  execFileSync(python, ['-m', 'zipfile', '-e', zip, directory]);
  const demo = join(directory, 'quorum-lab-demo');
  server = spawn(process.execPath, ['serve.mjs', 'site'], {
    cwd: demo,
    env: { ...process.env, PORT: '4180' },
    stdio: 'ignore',
    windowsHide: true,
  });
  await new Promise((resolveStarted, reject) => {
    server.once('spawn', resolveStarted);
    server.once('error', reject);
  });
  // The verifier runs against the extracted bundle, not the workspace dist directory.
  const child = spawn(process.execPath, ['scripts/verify-demo.mjs'], {
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      DEMO_URL: 'http://127.0.0.1:4180/quorum-lab/',
      VALIDATION_OUTPUT: 'acceptance/portable',
    },
  });
  const code = await new Promise((resolveCode, reject) => {
    child.once('error', reject);
    child.once('exit', resolveCode);
  });
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
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill();
    await new Promise((resolveExit) => server.once('exit', resolveExit));
  }
  const target = resolve(directory);
  if (dirname(target) !== temporaryRoot || !basename(target).startsWith('quorum-portable-'))
    throw new Error('Refusing to clean a directory outside the created portable-test workspace.');
  await rm(target, { recursive: true, force: true });
}
