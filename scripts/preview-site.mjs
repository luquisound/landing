import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function approvedSitePaths(manifest) {
  if (!Array.isArray(manifest) || manifest.some((entry) => typeof entry !== 'string')) {
    throw new TypeError('The public manifest must be an array of paths.');
  }
  return new Set(manifest.filter((entry) => {
    const pattern = /^site\/(?:[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:html|css|js)|assets\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:jpg|jpeg|png|webp|svg|mp4|webm))$/;
    return pattern.test(entry);
  }));
}

function requestPath(rawUrl) {
  const rawPath = rawUrl.split('?')[0];
  if (!rawPath.startsWith('/')) throw new URIError('Invalid request path.');
  const decoded = decodeURIComponent(rawPath);
  // Validate before URL normalization so encoded dot segments cannot disappear.
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('%') || decoded.includes('//') ||
      decoded.split('/').some((part) => part.startsWith('.'))) {
    return null;
  }
  return decoded === '/' ? 'site/index.html' : `site/${decoded.slice(1)}`;
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start;
  let end = size - 1;
  if (match[1]) {
    start = Number(match[1]);
    if (match[2]) {
      const requestedEnd = Number(match[2]);
      if (!Number.isSafeInteger(requestedEnd)) return null;
      end = Math.min(end, requestedEnd);
    }
  } else {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength === 0) return null;
    start = Math.max(0, size - suffixLength);
  }
  if (!Number.isSafeInteger(start) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}

function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

export async function createPreviewServer({ root = repositoryRoot, manifest } = {}) {
  const canonicalRoot = await realpath(path.resolve(root));
  const publicManifest = manifest ?? JSON.parse(await readFile(path.join(canonicalRoot, 'public-files.json'), 'utf8'));
  const allowed = approvedSitePaths(publicManifest);

  const server = http.createServer({ maxHeaderSize: 16 * 1024 }, async (request, response) => {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Cache-Control': 'no-cache',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const relative = requestPath(request.url);
      if (relative === null || !allowed.has(relative)) {
        response.writeHead(403, headers).end();
        return;
      }
      const target = path.resolve(canonicalRoot, ...relative.split('/'));
      const resolvedTarget = await realpath(target);
      // A listed file must not be redirected by a symlink or parent junction.
      if (!samePath(resolvedTarget, target)) {
        response.writeHead(403, headers).end();
        return;
      }
      const information = await stat(target);
      if (!information.isFile()) {
        response.writeHead(404, headers).end();
        return;
      }
      headers['Content-Type'] = contentTypes[path.extname(target)];
      headers['Accept-Ranges'] = 'bytes';
      let start = 0;
      let end = information.size - 1;
      let status = 200;
      if (request.headers.range !== undefined) {
        const range = byteRange(request.headers.range, information.size);
        if (range === null) {
          response.writeHead(416, { ...headers, 'Content-Range': `bytes */${information.size}` }).end();
          return;
        }
        ({ start, end } = range);
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${information.size}`;
      }
      headers['Content-Length'] = information.size === 0 ? 0 : end - start + 1;
      response.writeHead(status, headers);
      if (request.method === 'HEAD' || information.size === 0) {
        response.end();
        return;
      }
      const stream = createReadStream(target, { start, end });
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      const status = error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : error instanceof URIError ? 400 : 500;
      if (response.headersSent) response.destroy();
      else response.writeHead(status, headers).end();
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;
  server.maxRequestsPerSocket = 100;
  return server;
}

function cliPort(arguments_) {
  if (arguments_.length === 0) return null;
  if (arguments_.length !== 2 || arguments_[0] !== '--port' || !/^\d+$/.test(arguments_[1])) {
    throw new TypeError('Usage: node scripts/preview-site.mjs [--port 1-65535]');
  }
  const port = Number(arguments_[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError('The port must be an integer from 1 to 65535.');
  }
  return port;
}

async function runPreview() {
  const explicitPort = cliPort(process.argv.slice(2));
  const server = await createPreviewServer();
  let port = explicitPort ?? 4173;
  server.on('error', (error) => {
    if (explicitPort === null && error.code === 'EADDRINUSE' && port < 4180) {
      server.listen(++port, '127.0.0.1');
      return;
    }
    console.error(`Preview could not start: ${error.message}`);
    process.exitCode = 1;
  });
  server.on('listening', () => {
    console.log(`Luquisound preview: http://127.0.0.1:${port}/`);
    console.log('Press Ctrl+C to stop.');
  });
  server.listen(port, '127.0.0.1');
}

if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  runPreview().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
