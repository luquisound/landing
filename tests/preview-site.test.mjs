import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, mkdtemp, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPreviewServer } from '../scripts/preview-site.mjs';

function request(server, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const operation = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: requestPath,
      method: options.method ?? 'GET',
      headers: options.headers,
      agent: false,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    operation.setTimeout(5_000, () => operation.destroy(new Error('Preview request timed out.')));
    operation.on('error', reject);
    operation.end();
  });
}

test('preview serves only approved site files with working media ranges', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'luquisound-preview-test-'));
  const directories = [path.join(root, 'site'), path.join(root, 'site', 'assets'), path.join(root, 'private'), path.join(root, 'redirect-root')];
  const files = [
    ['site/index.html', '<!doctype html><title>Preview</title>'],
    ['site/app.js', 'document.title = "Preview";'],
    ['site/assets/video.mp4', Buffer.from('0123456789')],
    ['site/assets/empty.mp4', Buffer.alloc(0)],
    ['site/unlisted.html', 'not approved'],
    ['site/assets/PROVENANCE.md', 'private provenance'],
    ['private/secret.txt', 'private secret'],
    ['private/index.html', 'private index'],
    ['site/assets/logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0L1 1Z"/></svg>'],
    ['site/assets/barlow-regular.woff2', Buffer.from('font-bytes')],
    ['site/assets/barlow-license.txt', 'SIL OPEN FONT LICENSE Version 1.1\n'],
    ['site/assets/unreviewed.svg', '<svg/>'],
    ['site/assets/unreviewed.woff2', 'not approved'],
    ['site/assets/unreviewed.txt', 'not approved'],
    ['public-files.json', JSON.stringify(['site/index.html', 'site/app.js', 'site/assets/video.mp4', 'site/assets/empty.mp4',
      'site/assets/linked.mp4', 'private/secret.txt', 'site/assets/PROVENANCE.md', 'site/assets/logo.svg',
      'site/assets/barlow-regular.woff2', 'site/assets/barlow-license.txt', 'site/assets/unreviewed.svg',
      'site/assets/unreviewed.woff2', 'site/assets/unreviewed.txt'])],
  ];
  const links = [];
  let server;
  try {
    for (const directory of directories) await mkdir(directory);
    for (const [relative, content] of files) await writeFile(path.join(root, ...relative.split('/')), content);
    server = await createPreviewServer({ root });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    await context.test('serves selected SVG, local font and license files with MIME, HEAD and ranges', async () => {
      for (const [route, mime] of [['/assets/logo.svg', 'image/svg+xml'],
        ['/assets/barlow-regular.woff2', 'font/woff2'], ['/assets/barlow-license.txt', 'text/plain; charset=utf-8']]) {
        const expected = Buffer.from(files.find(([file]) => file === `site${route}`)[1]);
        const full = await request(server, route);
        assert.equal(full.status, 200, route);
        assert.equal(full.headers['content-type'], mime);
        assert.equal(full.headers['x-content-type-options'], 'nosniff');
        assert.deepEqual(full.body, expected);
        const head = await request(server, route, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(head.headers['content-type'], mime);
        assert.equal(Number(head.headers['content-length']), expected.length);
        assert.equal(head.body.length, 0);
        const partial = await request(server, route, { headers: { Range: 'bytes=0-3' } });
        assert.equal(partial.status, 206);
        assert.equal(partial.headers['content-range'], `bytes 0-3/${expected.length}`);
        assert.deepEqual(partial.body, expected.subarray(0, 4));
      }
    });

    await context.test('serves HTML, JavaScript and HEAD using the manifest', async () => {
      const html = await request(server, '/?preview=1');
      assert.equal(html.status, 200);
      assert.equal(html.body.toString(), files[0][1]);
      assert.equal(html.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(html.headers['x-content-type-options'], 'nosniff');
      const script = await request(server, '/app.js');
      assert.equal(script.status, 200);
      assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
      assert.equal(script.body.toString(), files[1][1]);
      const head = await request(server, '/assets/video.mp4', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers['content-type'], 'video/mp4');
      assert.equal(head.headers['content-length'], '10');
      assert.equal(head.body.length, 0);
      assert.equal(server.headersTimeout, 10_000);
      assert.equal(server.requestTimeout, 15_000);
    });

    await context.test('serves complete, bounded, open-ended and suffix video ranges', async () => {
      const full = await request(server, '/assets/video.mp4');
      assert.equal(full.status, 200);
      assert.equal(full.body.toString(), '0123456789');
      for (const [range, expected, contentRange] of [
        ['bytes=2-5', '2345', 'bytes 2-5/10'],
        ['bytes=7-', '789', 'bytes 7-9/10'],
        ['bytes=-3', '789', 'bytes 7-9/10'],
        ['bytes=-20', '0123456789', 'bytes 0-9/10'],
        ['bytes=8-20', '89', 'bytes 8-9/10'],
      ]) {
        const response = await request(server, '/assets/video.mp4', { headers: { Range: range } });
        assert.equal(response.status, 206, range);
        assert.equal(response.headers['content-range'], contentRange);
        assert.equal(response.body.toString(), expected);
        assert.equal(Number(response.headers['content-length']), expected.length);
      }
      const rangeHead = await request(server, '/assets/video.mp4', { method: 'HEAD', headers: { Range: 'bytes=2-5' } });
      assert.equal(rangeHead.status, 206);
      assert.equal(rangeHead.headers['content-length'], '4');
      assert.equal(rangeHead.body.length, 0);
      const empty = await request(server, '/assets/empty.mp4');
      assert.equal(empty.status, 200);
      assert.equal(empty.headers['content-length'], '0');
      assert.equal(empty.body.length, 0);
    });

    await context.test('rejects malformed and unsatisfiable ranges', async () => {
      for (const range of ['bytes=10-', 'bytes=9-3', 'bytes=-0', 'bytes=-', 'bytes=1-2,4-5',
        'items=1-2', 'bytes=9007199254740993-', 'bytes=0-9007199254740993', 'bytes=-9007199254740993']) {
        const response = await request(server, '/assets/video.mp4', { headers: { Range: range } });
        assert.equal(response.status, 416, range);
        assert.equal(response.headers['content-range'], 'bytes */10');
      }
      const empty = await request(server, '/assets/empty.mp4', { headers: { Range: 'bytes=0-' } });
      assert.equal(empty.status, 416);
      assert.equal(empty.headers['content-range'], 'bytes */0');
    });

    await context.test('rejects private paths, traversal, unknown files and unsupported methods', async () => {
      for (const route of ['/private/secret.txt', '/docs/project-context.local.md', '/public-files.json',
        '/.git/config', '/unlisted.html', '/assets/PROVENANCE.md', '/site/index.html',
        '/assets/unreviewed.svg', '/assets/unreviewed.woff2', '/assets/unreviewed.txt',
        '/assets/pliant-bold-expanded.woff2', '/assets/pliant-license.txt',
        '/../private/secret.txt', '/%2e%2e/private/secret.txt', '/%2e%2e/index.html',
        '/private/../index.html', '/%252e%252e/private/secret.txt', '/assets%5c..%5cindex.html', '//index.html']) {
        const response = await request(server, route);
        assert.equal(response.status, 403, route);
        assert.equal(response.body.length, 0);
      }
      assert.equal((await request(server, '/%ZZ')).status, 400);
      const unsupported = await request(server, '/', { method: 'POST' });
      assert.equal(unsupported.status, 405);
      assert.equal(unsupported.headers.allow, 'GET, HEAD');
      assert.equal((await request(server, '/assets/linked.mp4')).status, 404);
    });

    await context.test('rejects an approved path redirected by a file symlink', async (symlinkContext) => {
      const fileLink = path.join(root, 'site', 'assets', 'linked.mp4');
      try {
        await symlink(path.join(root, 'private', 'secret.txt'), fileLink, 'file');
        links.push(fileLink);
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP') {
          symlinkContext.skip('The host does not permit fixture symlinks.');
          return;
        }
        throw error;
      }
      assert.equal((await request(server, '/assets/linked.mp4')).status, 403);
    });

    await context.test('rejects an approved file inside a redirected parent directory', async (symlinkContext) => {
      const redirectedRoot = path.join(root, 'redirect-root');
      const directoryLink = path.join(redirectedRoot, 'site');
      try {
        await symlink(path.join(root, 'private'), directoryLink, process.platform === 'win32' ? 'junction' : 'dir');
        links.push(directoryLink);
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP') {
          symlinkContext.skip('The host does not permit fixture directory links.');
          return;
        }
        throw error;
      }
      const redirectedServer = await createPreviewServer({ root: redirectedRoot, manifest: ['site/index.html'] });
      await new Promise((resolve, reject) => {
        redirectedServer.once('error', reject);
        redirectedServer.listen(0, '127.0.0.1', resolve);
      });
      try {
        assert.equal((await request(redirectedServer, '/')).status, 403);
      } finally {
        await new Promise((resolve) => redirectedServer.close(resolve));
      }
    });
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    for (const link of links.reverse()) await unlink(link);
    for (const [relative] of files) {
      const file = path.join(root, ...relative.split('/'));
      try { await unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const directory of directories.reverse()) await rmdir(directory);
    await rmdir(root);
  }
});
