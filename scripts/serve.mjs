import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webm': 'video/webm',
};
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    if (path === '/quorum-lab') {
      res.writeHead(302, { location: '/quorum-lab/' });
      res.end();
      return;
    }
    if (path.startsWith('/quorum-lab/')) path = path.slice('/quorum-lab'.length);
    const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    const contained = relative(root, file);
    if (contained.startsWith('..') || isAbsolute(contained) || path.includes('\0')) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const address = `http://127.0.0.1:${server.address().port}/quorum-lab/`;
  console.log(`Quorum Lab: ${address}\nPress Ctrl+C to stop.`);
  process.send?.({ type: 'quorum-ready', url: address });
  if (process.argv.includes('--open') && process.platform === 'win32')
    spawn('explorer.exe', [address], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
});
