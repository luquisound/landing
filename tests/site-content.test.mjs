import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkSite } from '../scripts/check-site.mjs';

const catalog = [{ id: 'example', categories: ['audio'], serviceRefs: ['audio'],
  media: [{ type: 'image', src: 'assets/photo.jpg' }] }];
const index = '<main id="main"><a href="trabajos.html?categoria=audio#gallery">Work</a>' +
  '<a href="https://example.com/">External</a><a href="mailto:hello@example.com">Email</a></main>';
const works = '<main id="gallery"><a data-open-service="audio" href="assets/photo.jpg">Audio</a>' +
  '<a data-case="example" data-category="audio" href="assets/photo.jpg">Example</a></main>';

async function fixture(t, { entries = {}, cases = catalog, omitted = [], unapproved = [] } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'luquisound-site-content-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.match(path.basename(root), /^luquisound-site-content-/);
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'site/assets'), { recursive: true });
  const files = {
    'site/index.html': index,
    'site/trabajos.html': works,
    'site/styles.css': '@font-face {src: url("assets/font.woff2")} .image {background:url(assets/photo.jpg)}',
    'site/cases.js': `window.LuquisoundCases = ${JSON.stringify(cases)};`,
    'site/assets/photo.jpg': 'image fixture',
    'site/assets/font.woff2': 'font fixture',
    ...entries,
  };
  for (const [file, source] of Object.entries(files)) {
    if (!omitted.includes(file)) await writeFile(path.join(root, file), source);
  }
  return { root, manifest: Object.keys(files).filter(file => !unapproved.includes(file)) };
}

test('the current approved site has coherent references and cases', async () => {
  assert.deepEqual(await checkSite(), []);
});

test('accepts local query links, per-page ids, CSS assets and external links', async t => {
  const options = await fixture(t, { entries: {
    'site/index.html': index + '<p id="shared">Shared</p><a href="#shared">Anchor</a>',
    'site/trabajos.html': works + '<p id="shared">Shared on another page</p>',
  } });
  assert.deepEqual(await checkSite(options), []);
});

test('rejects missing and unapproved assets across HTML, CSS and JavaScript', async t => {
  const options = await fixture(t, { omitted: ['site/assets/photo.jpg'], entries: {
    'site/index.html': index + '<video poster="assets/private.jpg" data-mobile-source="assets/mobile.mp4"></video>' +
      '<img srcset="assets/photo.jpg 1x, assets/large.jpg 2x">',
    'site/styles.css': 'a{background:url("assets/background.jpg")}',
    'site/app.js': 'const path = "assets/other.jpg";',
  } });
  const issues = (await checkSite(options)).join('\n');
  for (const name of ['photo.jpg', 'private.jpg', 'mobile.mp4', 'large.jpg', 'background.jpg', 'other.jpg']) {
    assert.ok(issues.includes(name), name);
  }
  assert.match(issues, /missing file/);
  assert.match(issues, /unapproved path/);
});

test('rejects duplicate ids, missing anchors and invalid local ARIA references', async t => {
  const options = await fixture(t, { entries: {
    'site/index.html': index + '<p id="main">Duplicate</p><a href="trabajos.html#absent">Bad anchor</a>' +
      '<button aria-controls="absent">Open</button>',
  } });
  const issues = (await checkSite(options)).join('\n');
  assert.match(issues, /duplicate id "main"/);
  assert.match(issues, /missing anchor/);
  assert.match(issues, /aria-controls references missing id/);
});

test('rejects duplicate or unknown case ids and category drift', async t => {
  const options = await fixture(t, { entries: {
    'site/trabajos.html': works.replace('data-category="audio"', 'data-category="other"') +
      '<a data-case="example" data-category="audio">Duplicate</a><a data-case="unknown">Unknown</a>',
  } });
  const issues = (await checkSite(options)).join('\n');
  assert.match(issues, /duplicate data-case "example"/);
  assert.match(issues, /unknown data-case "unknown"/);
  assert.match(issues, /categories differ from catalog/);
});

test('rejects duplicate catalog ids and invalid service references', async t => {
  const options = await fixture(t, { cases: [{ ...catalog[0], serviceRefs: ['absent'] }, catalog[0]] });
  const issues = (await checkSite(options)).join('\n');
  assert.match(issues, /duplicate case id "example"/);
  assert.match(issues, /serviceRefs must contain unique known service ids/);
});

test('rejects catalog entries without a gallery card or valid media', async t => {
  const options = await fixture(t, { cases: [{ ...catalog[0], id: 'orphan', media: [] }] });
  const issues = (await checkSite(options)).join('\n');
  assert.match(issues, /missing gallery card/);
  assert.match(issues, /media must be a nonempty array/);
});

test('checks catalog media paths even when they do not use the assets prefix', async t => {
  const options = await fixture(t, { cases: [{ ...catalog[0],
    media: [{ type: 'video', src: 'missing.mp4', poster: 'missing.jpg' }] }] });
  const issues = (await checkSite(options)).join('\n');
  assert.match(issues, /media source \(example\) references unapproved path "missing.mp4"/);
  assert.match(issues, /media poster \(example\) references unapproved path "missing.jpg"/);
});

test('rejects a broken or non-array catalog without hanging the check', async t => {
  for (const source of ['while (true) {}', 'window.LuquisoundCases = {};', 'window.LuquisoundCases = null;']) {
    const options = await fixture(t, { entries: { 'site/cases.js': source } });
    assert.match((await checkSite(options)).join('\n'), /catalog must define a static LuquisoundCases array/, source);
  }
});
