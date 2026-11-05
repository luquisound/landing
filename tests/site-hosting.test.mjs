import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildSite } from '../scripts/build-site.mjs';
import worker from '../scripts/site-worker.mjs';

test('production bundle contains approved files and generated security headers without replacing existing output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'luquisound-build-test-'));
  const output = path.join(root, 'bundle');
  const video = Buffer.alloc(24);
  video.writeUInt32BE(24);
  video.write('ftypisom', 4, 'ascii');
  video.write('isom', 16, 'ascii');
  const fixture = [
    ['public-files.json', JSON.stringify(['public-files.json', 'site/index.html', 'site/app.js', 'site/assets/selected.mp4'])],
    ['site/index.html', '<!doctype html><title>Approved</title>'],
    ['site/app.js', 'document.title = "Approved";'],
    ['site/assets/selected.mp4', video],
    ['site/assets/workshop.mp4', 'private unapproved video'],
    ['site/secret.html', 'private unapproved page'],
    ['site/_headers', '/*\n  Content-Security-Policy: default-src *\n'],
    ['scripts/site-worker.mjs', 'export default { fetch(request, env) { return new Response(JSON.stringify({ lengths: env.VIDEO_LENGTHS, inherited: env.inherited })); } };'],
  ];
  try {
    await mkdir(path.join(root, 'site', 'assets'), { recursive: true });
    await mkdir(path.join(root, 'scripts'));
    for (const [file, content] of fixture) await writeFile(path.join(root, ...file.split('/')), content);
    const result = await buildSite({ root, output });
    assert.equal(result.files, 3);
    assert.equal(result.assets, path.join(output, 'site'));
    assert.deepEqual((await readdir(output)).sort(), ['site', 'worker.mjs']);
    assert.deepEqual((await readdir(result.assets)).sort(), ['_headers', 'app.js', 'assets', 'index.html']);
    assert.deepEqual(await readdir(path.join(result.assets, 'assets')), ['selected.mp4']);
    assert.equal(await readFile(path.join(result.assets, 'index.html'), 'utf8'), fixture[1][1]);
    const [headerPath, ...headerLines] = (await readFile(path.join(result.assets, '_headers'), 'utf8')).trimEnd().split('\n');
    assert.equal(headerPath, '/*');
    const staticHeaders = new Headers(headerLines.map((line) => {
      const match = /^  ([^:]+): (.+)$/.exec(line);
      assert.ok(match, `Invalid generated header: ${line}`);
      return [match[1], match[2]];
    }));
    const protectedAsset = await worker.fetch(new Request('https://luquisound.com/app.js'), {
      ASSETS: { fetch() { return new Response(fixture[2][1], { headers: { 'Content-Type': 'text/javascript' } }); } },
    });
    assert.deepEqual([...staticHeaders.keys()], [
      'content-security-policy', 'permissions-policy', 'referrer-policy',
      'strict-transport-security', 'x-content-type-options', 'x-frame-options',
    ]);
    for (const [name, value] of staticHeaders) assert.equal(value, protectedAsset.headers.get(name), name);
    await protectedAsset.body.cancel();
    const generated = (await import(pathToFileURL(path.join(output, 'worker.mjs')).href)).default;
    const metadata = await generated.fetch(new Request('https://luquisound.com/'), { inherited: 'binding' });
    assert.deepEqual(await metadata.json(), { lengths: { '/assets/selected.mp4': video.length }, inherited: 'binding' });
    await writeFile(path.join(output, 'unrelated.txt'), 'preserve existing output');
    await assert.rejects(buildSite({ root, output }), { code: 'EEXIST' });
    assert.equal(await readFile(path.join(output, 'unrelated.txt'), 'utf8'), 'preserve existing output');
    await unlink(path.join(output, 'unrelated.txt'));
  } finally {
    for (const file of ['site/_headers', 'site/app.js', 'site/index.html', 'site/assets/selected.mp4', 'worker.mjs']) {
      await unlink(path.join(output, ...file.split('/'))).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
    for (const directory of ['site/assets', 'site']) {
      await rmdir(path.join(output, ...directory.split('/'))).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
    await rmdir(output).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    for (const [file] of fixture) await unlink(path.join(root, ...file.split('/')));
    await rmdir(path.join(root, 'site', 'assets'));
    await rmdir(path.join(root, 'site'));
    await rmdir(path.join(root, 'scripts'));
    await rmdir(root);
  }
});

test('production routing keeps HTML and videos in the Worker while ordinary approved assets bypass it', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(await readFile(new URL('../public-files.json', import.meta.url), 'utf8'));
  const patterns = config.assets.run_worker_first;
  assert.ok(Array.isArray(patterns), 'Worker-first routing must be selective.');
  const workerRoutes = patterns.map((pattern) => {
    assert.match(pattern, /^\//);
    const escaped = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${escaped}$`);
  });
  const runsWorkerFirst = (pathname) => workerRoutes.some((route) => route.test(pathname));
  assert.equal(runsWorkerFirst('/'), true);
  for (const file of manifest.filter((entry) => entry.startsWith('site/'))) {
    const pathname = `/${file.slice('site/'.length)}`;
    assert.equal(runsWorkerFirst(pathname), /\.(?:html|mp4)$/.test(file), pathname);
  }
  assert.equal(config.assets.html_handling, 'none');
  assert.equal(config.assets.not_found_handling, 'none');
});

test('production bundle rejects manifest paths redirected through a directory link', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'luquisound-linked-build-test-'));
  const output = path.join(root, 'bundle');
  const target = path.join(root, 'private');
  const link = path.join(root, 'site');
  let linked = false;
  try {
    await mkdir(target);
    await writeFile(path.join(target, 'index.html'), 'private document');
    await writeFile(path.join(root, 'public-files.json'), JSON.stringify(['public-files.json', 'site/index.html']));
    try {
      await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
      linked = true;
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        context.skip('The host does not permit fixture directory links.');
        return;
      }
      throw error;
    }
    await assert.rejects(buildSite({ root, output }), /linked paths are prohibited/);
    assert.deepEqual(await readdir(output), []);
  } finally {
    if (linked) await unlink(link);
    await rmdir(output).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await unlink(path.join(root, 'public-files.json'));
    await unlink(path.join(target, 'index.html'));
    await rmdir(target);
    await rmdir(root);
  }
});

test('landing canonical redirects preserve navigation and never read assets', async () => {
  const env = { ASSETS: { fetch() { throw new Error('Redirects must not read assets.'); } } };
  for (const [source, target] of [
    ['http://luquisound.com/contacto.html?interes=Audio', 'https://luquisound.com/contacto.html?interes=Audio'],
    ['https://www.luquisound.com/trabajos.html?caso=1', 'https://luquisound.com/trabajos.html?caso=1'],
    ['http://www.luquisound.com/index.html?from=1', 'https://luquisound.com/?from=1'],
    ['https://luquisound.com/index.html', 'https://luquisound.com/'],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(new Request(source, { method }), env);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('Location'), target);
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
      assert.equal(await response.text(), '');
    }
  }
  assert.equal((await worker.fetch(new Request('https://unknown.example/'), env)).status, 404);
  const post = await worker.fetch(new Request('http://luquisound.com/', { method: 'POST', body: 'private' }), env);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  assert.equal(post.headers.get('Location'), null);
});

test('landing forwards asset requests and range responses under the production security policy', async () => {
  for (const origin of ['https://luquisound.com', 'http://localhost:8787', 'http://127.0.0.1:8787']) {
    const request = new Request(`${origin}/assets/selected.mp4`, { headers: { Range: 'bytes=0-3' } });
    const response = await worker.fetch(request, { ASSETS: { fetch(actual) {
      assert.equal(actual, request);
      assert.equal(actual.headers.get('Range'), 'bytes=0-3');
      return new Response('0123', { status: 206, headers: { 'Content-Range': 'bytes 0-3/10', 'Content-Type': 'video/mp4' } });
    } } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 0-3/10');
    assert.equal(response.headers.get('Content-Type'), 'video/mp4');
    assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.match(response.headers.get('Content-Security-Policy'), /style-src 'self' 'sha256-tVhPjph7qMo1hPF94qNd\+HSuirEXRpfd7f1Ze5YKUoY='/);
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
    assert.equal(response.headers.get('Strict-Transport-Security'), origin.startsWith('https:') ? 'max-age=31536000' : null);
    assert.equal(await response.text(), '0123');
  }
});

test('landing serves the root document without enabling an SPA fallback', async () => {
  const calls = [];
  const env = { ASSETS: { fetch(request) {
    calls.push(request);
    const known = new URL(request.url).pathname === '/index.html';
    return new Response(known && request.method !== 'HEAD' ? '<title>Landing</title>' : null, { status: known ? 200 : 404 });
  } } };
  for (const method of ['GET', 'HEAD']) {
    const request = new Request('https://luquisound.com/?from=campaign', { method, headers: { Range: 'bytes=0-15' } });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(await response.text(), method === 'GET' ? '<title>Landing</title>' : '');
    const actual = calls.at(-1);
    assert.equal(actual.url, 'https://luquisound.com/index.html?from=campaign');
    assert.equal(actual.method, method);
    assert.equal(actual.headers.get('Range'), 'bytes=0-15');
  }
  const missing = new Request('https://luquisound.com/missing');
  assert.equal((await worker.fetch(missing, env)).status, 404);
  assert.equal(calls.at(-1), missing);
});

function videoAssets({ etag = '"video-v1"' } = {}) {
  return { ASSETS: { fetch(request) {
    return new Response(request.method === 'HEAD' ? null : '0123456789', {
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': '10', ETag: etag },
    });
  } } };
}

test('video ranges serve exact bounded, open-ended and suffix bytes', async () => {
  for (const [range, content, contentRange] of [
    ['bytes=0-3', '0123', 'bytes 0-3/10'],
    ['bytes=3-7', '34567', 'bytes 3-7/10'],
    ['bytes=4-', '456789', 'bytes 4-9/10'],
    ['bytes=-4', '6789', 'bytes 6-9/10'],
    ['bytes=-50', '0123456789', 'bytes 0-9/10'],
    ['bytes=6-99', '6789', 'bytes 6-9/10'],
  ]) {
    const response = await worker.fetch(new Request('https://luquisound.com/assets/video.mp4', {
      headers: { Range: range, 'If-Range': '"video-v1"' },
    }), videoAssets());
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('Content-Range'), contentRange, range);
    assert.equal(response.headers.get('Content-Length'), String(content.length), range);
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(await response.text(), content, range);
  }
});

test('invalid and unsatisfiable single video ranges return an empty 416', async () => {
  for (const range of ['bytes=-', 'bytes=10-', 'bytes=4-2', 'bytes=-0', 'items=0-1', '',
    'bytes=9007199254740992-', 'bytes=0-9007199254740992', 'bytes=-9007199254740992']) {
    const response = await worker.fetch(new Request('https://luquisound.com/assets/video.mp4', {
      headers: { Range: range },
    }), videoAssets());
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
    assert.equal(response.headers.get('Content-Length'), '0');
    assert.equal(await response.text(), '');
  }
});

test('video full responses retain normal lengths for no range, multiple ranges, HEAD and If-Range fallback', async () => {
  for (const [method, headers, etag] of [
    ['GET', {}, '"video-v1"'],
    ['GET', { Range: 'bytes=0-1,5-6' }, '"video-v1"'],
    ['GET', { Range: 'bytes=0-1', 'If-Range': '"other-version"' }, '"video-v1"'],
    ['GET', { Range: 'bytes=0-1', 'If-Range': 'Wed, 04 Nov 2026 12:00:00 GMT' }, '"video-v1"'],
    ['GET', { Range: 'bytes=0-1', 'If-Range': 'W/"video-v1"' }, 'W/"video-v1"'],
    ['HEAD', { Range: 'bytes=0-1' }, '"video-v1"'],
  ]) {
    const response = await worker.fetch(new Request('https://luquisound.com/assets/video.mp4', { method, headers }), videoAssets({ etag }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Range'), null);
    assert.equal(response.headers.get('Content-Length'), '10');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(await response.text(), method === 'HEAD' ? '' : '0123456789');
  }
});

test('video range streaming skips chunks and cancels the upstream immediately after the selected bytes', async () => {
  const encoder = new TextEncoder();
  const chunks = ['012', '345', '678', '9'];
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (reads === chunks.length) controller.close();
      else controller.enqueue(encoder.encode(chunks[reads++]));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const response = await worker.fetch(new Request('https://luquisound.com/assets/video.mp4', {
    headers: { Range: 'bytes=2-4' },
  }), { ASSETS: { fetch() { return new Response(body, { headers: { 'Content-Type': 'video/mp4', 'Content-Length': '10' } }); } } });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), '234');
  assert.equal(reads, 2);
  assert.equal(cancelled, true);
});

test('trusted build metadata supplies video lengths omitted by the asset binding', async () => {
  const env = { VIDEO_LENGTHS: { '/assets/video.mp4': 10 }, ASSETS: { fetch(request) {
    return new Response(request.method === 'HEAD' ? null : '0123456789', { headers: { 'Content-Type': 'video/mp4' } });
  } } };
  for (const [method, range, status, length, content] of [
    ['GET', 'bytes=2-4', 206, '3', '234'],
    ['GET', undefined, 200, '10', '0123456789'],
    ['HEAD', 'bytes=2-4', 200, '10', ''],
  ]) {
    const response = await worker.fetch(new Request('https://luquisound.com/assets/video.mp4', {
      method, headers: range ? { Range: range } : {},
    }), env);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Content-Length'), length);
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal(await response.text(), content);
  }
});

test('HTML disallows provider transformations while preserving existing cache directives', async () => {
  for (const cacheControl of [undefined, 'public, max-age=0, must-revalidate', 'private, no-cache, no-transform']) {
    const response = await worker.fetch(new Request('https://luquisound.com/'), { ASSETS: { fetch() {
      return new Response('<title>Landing</title>', { headers: {
        'Content-Type': 'text/html; charset=utf-8', ...(cacheControl === undefined ? {} : { 'Cache-Control': cacheControl }),
      } });
    } } });
    const actual = response.headers.get('Cache-Control');
    assert.equal(actual, cacheControl === 'private, no-cache, no-transform'
      ? cacheControl : `${cacheControl ?? 'public, max-age=0, must-revalidate'}, no-transform`);
    assert.equal(actual.match(/no-transform/g).length, 1);
    assert.equal(response.headers.get('Content-Security-Policy').includes('static.cloudflareinsights.com'), false);
  }
});
