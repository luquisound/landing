import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentIssues, fileContentIssues, indexedContentIssues, manifestIssues,
  mediaFileSizeLimit, mediaIssues, pathIssues, readPublicBytes, readPublicFile } from '../scripts/public-policy.mjs';

const jpegFixture = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
const pngChunk = (type, data) => {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  return chunk;
};
const pngHeader = Buffer.alloc(13);
pngHeader.writeUInt32BE(1);
pngHeader.writeUInt32BE(1, 4);
const pngStart = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', pngHeader)]);
const pngEnd = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const pngFixture = Buffer.concat([pngStart, pngEnd]);
const mp4Fixture = Buffer.alloc(24);
mp4Fixture.writeUInt32BE(24);
mp4Fixture.write('ftypisom', 4, 'ascii');
mp4Fixture.write('isom', 16, 'ascii');

test('rejects private, generated, noncanonical and media paths even if added to a manifest', () => {
  for (const file of ['.env', '.env.example', 'docs/project-context.local.md', 'assets/PROVENANCE.md',
    '01-immersive/app.js', '03-gallery/index.html', '.codex/config.json', '.git/config',
    'node_modules/example/package.json', '../README.md', '/README.md', 'docs//a.md',
    'docs\\a.md', 'assets/photo.jpg', 'assets/video.mp4', 'credentials.pem',
    'site/assets/PROVENANCE.md', 'site/notes.md', 'site/nested/app.js', 'site/assets/app.js',
    'site/index.mjs', 'site/assets/video.mov', 'Site/index.html', 'docs/app.js',
    '.vercel/project.json', 'library/notes.md', 'docs/file:private.md', 'docs/*.md', 'docs/[a].md']) {
    assert.ok(pathIssues(file).length > 0, file);
  }
});

test('accepts public infrastructure paths', () => {
  for (const file of ['README.md', '.gitignore', '.github/CODEOWNERS', 'scripts/check-public.mjs', '.github/workflows/ci.yml']) {
    assert.deepEqual(pathIssues(file), []);
  }
});

test('allows direct frontend files and media only inside the reviewed site locations', () => {
  for (const file of ['preview.mjs', 'site/index.html', 'site/styles.css', 'site/app.js',
    'site/work-gallery.js', 'site/assets/photo.jpg', 'site/assets/logo.png', 'site/assets/workshop.mp4']) {
    assert.deepEqual(pathIssues(file), [], file);
  }
  assert.deepEqual(manifestIssues(['public-files.json', 'site/index.html', 'site/assets/photo.jpg']), []);
  assert.ok(manifestIssues(['public-files.json', 'site/*.html']).length > 0);
});

test('media checks enforce approved paths, signatures, format-specific bounds and no common image metadata', () => {
  for (const [file, bytes] of [['site/assets/photo.jpg', jpegFixture],
    ['site/assets/logo.png', pngFixture], ['site/assets/workshop.mp4', mp4Fixture]]) {
    assert.deepEqual(mediaIssues(file, bytes), [], file);
    assert.deepEqual(fileContentIssues(file, bytes), [], file);
    assert.ok(mediaIssues(file, Buffer.from('not media')).length > 0, file);
  }
  assert.ok(mediaIssues('assets/photo.jpg', jpegFixture).length > 0);
  assert.ok(mediaIssues('site/assets/photo.jpg', Buffer.alloc(8 * 1024 * 1024 + 1)).length > 0);
  assert.ok(mediaIssues('site/assets/workshop.mp4', Buffer.alloc(35 * 1024 * 1024 + 1)).length > 0);
  assert.equal(mediaFileSizeLimit('site/assets/photo.jpg'), 8 * 1024 * 1024);
  assert.equal(mediaFileSizeLimit('site/assets/workshop.mp4'), 35 * 1024 * 1024);
  assert.equal(mediaFileSizeLimit('assets/photo.jpg'), undefined);
  for (const marker of [0xe1, 0xed, 0xfe]) {
    const bytes = Buffer.concat([jpegFixture.subarray(0, 2), Buffer.from([0xff, marker, 0, 2]), jpegFixture.subarray(2)]);
    assert.deepEqual(mediaIssues('site/assets/photo.jpg', bytes), ['embedded JPEG metadata']);
    const betweenScans = Buffer.concat([jpegFixture.subarray(0, -2), Buffer.from([0, 0xff, 0, 0xff, marker, 0, 2, 0xff, 0xd9])]);
    assert.deepEqual(mediaIssues('site/assets/photo.jpg', betweenScans), ['embedded JPEG metadata']);
  }
  for (const type of ['eXIf', 'tEXt', 'iTXt', 'zTXt']) {
    const bytes = Buffer.concat([pngStart, pngChunk(type, Buffer.from('private')), pngEnd]);
    assert.deepEqual(mediaIssues('site/assets/logo.png', bytes), ['embedded PNG metadata']);
  }
  const invalidBox = Buffer.from(mp4Fixture);
  invalidBox.writeUInt32BE(100);
  assert.deepEqual(mediaIssues('site/assets/workshop.mp4', invalidBox), ['invalid MP4 signature']);
});

test('index validation preserves binary bytes and detects unreviewed media or unsafe staged text', () => {
  assert.deepEqual(indexedContentIssues('site/assets/photo.jpg', jpegFixture, Buffer.from(jpegFixture)), []);
  const changed = Buffer.from(jpegFixture);
  changed[7] = 1;
  assert.ok(indexedContentIssues('site/assets/photo.jpg', changed, jpegFixture).includes('index media differs from the reviewed working copy'));
  const token = Buffer.from('gh' + 'p_' + 'a'.repeat(36));
  assert.ok(indexedContentIssues('site/app.js', token, Buffer.from('safe')).includes('GitHub token'));
  assert.deepEqual(indexedContentIssues('site/app.js', Buffer.from([0xff]), Buffer.from('safe')), ['invalid UTF-8']);
});

test('detects credentials without requiring real secrets', () => {
  for (const sample of [
    ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
    'gh' + 'p_' + 'a'.repeat(36),
    'github_' + 'pat_' + 'a'.repeat(70),
    'AK' + 'IA' + 'A'.repeat(16),
    'xox' + 'b-' + 'a'.repeat(24),
    'AI' + 'za' + 'a'.repeat(35),
    'https://' + 'example:synthetic' + '@example.invalid',
  ]) assert.ok(contentIssues(sample).length > 0);
});

test('detects private local routes and binary content', () => {
  for (const sample of ['X' + ':' + '/Private/document.txt', '/' + 'home/example/private/', 'text\0binary']) {
    assert.ok(contentIssues(sample).length > 0);
  }
});

test('allows normal public URLs, action SHA pins and policy text', () => {
  assert.deepEqual(contentIssues('https://github.com/luquisound/landing actions/checkout@' + 'a'.repeat(40)), []);
});

test('rejects invalid, duplicate and self-omitting manifests', () => {
  for (const files of [null, {}, [], [false], ['README.md'], ['public-files.json', 'public-files.json']]) {
    assert.ok(manifestIssues(files).length > 0);
  }
  assert.deepEqual(manifestIssues(['public-files.json', 'README.md']), []);
});

test('file reader accepts UTF-8 and rejects oversized files, invalid UTF-8 and directories', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'luquisound-policy-'));
  const target = path.join(directory, 'fixture.md');
  try {
    await writeFile(target, 'Public fixture\n');
    assert.equal(await readPublicFile(target), 'Public fixture\n');
    await writeFile(target, Buffer.alloc(256 * 1024 + 1));
    await assert.rejects(readPublicFile(target), /size limit/);
    await writeFile(target, Buffer.from([0xff]));
    await assert.rejects(readPublicFile(target));
    await assert.rejects(readPublicFile(directory));
  } finally {
    await unlink(target);
    await rmdir(directory);
  }
});

test('bounded binary reader preserves bytes and rejects files over its supplied limit', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'luquisound-policy-'));
  const target = path.join(directory, 'fixture.jpg');
  try {
    await writeFile(target, jpegFixture);
    assert.deepEqual(await readPublicBytes(target, jpegFixture.length), jpegFixture);
    await assert.rejects(readPublicBytes(target, jpegFixture.length - 1), /size limit/);
    await assert.rejects(readPublicBytes(target, -1), /invalid public file size limit/);
    await assert.rejects(readPublicBytes(directory));
  } finally {
    await unlink(target);
    await rmdir(directory);
  }
});

test('file reader rejects symlink targets when the OS permits symlink creation', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'luquisound-policy-'));
  const target = path.join(directory, 'fixture.md');
  const link = path.join(directory, 'link.md');
  let linked = false;
  try {
    await writeFile(target, 'Public fixture\n');
    try {
      await symlink(target, link, 'file');
      linked = true;
    } catch (error) {
      if (error.code !== 'EPERM') throw error;
      context.skip('OS denied symlink creation');
      return;
    }
    await assert.rejects(readPublicFile(link));
    await assert.rejects(readPublicBytes(link, 8 * 1024 * 1024));
  } finally {
    if (linked) await unlink(link);
    await unlink(target);
    await rmdir(directory);
  }
});

test('publication guard rejects unsafe staged content when the working copy is safe', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'luquisound-index-'));
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  const runGuard = () => execFileSync(process.execPath, ['scripts/check-public.mjs'], { cwd: directory, stdio: 'pipe' });
  try {
    await mkdir(path.join(directory, 'scripts'));
    await mkdir(path.join(directory, 'site', 'assets'), { recursive: true });
    for (const file of ['scripts/check-public.mjs', 'scripts/public-policy.mjs']) {
      await copyFile(path.join(repository, file), path.join(directory, file));
    }
    const files = ['public-files.json', 'scripts/check-public.mjs', 'scripts/public-policy.mjs', 'site/index.html', 'site/assets/photo.jpg'];
    await writeFile(path.join(directory, 'public-files.json'), JSON.stringify(files));
    await writeFile(path.join(directory, 'site', 'index.html'), '<p>Public</p>');
    await writeFile(path.join(directory, 'site', 'assets', 'photo.jpg'), jpegFixture);
    git('init', '--quiet');
    git('add', '--', ...files);
    assert.match(runGuard().toString('utf8'), /Public boundary passed/);

    await writeFile(path.join(directory, 'site', 'index.html'), 'gh' + 'p_' + 'a'.repeat(36));
    git('add', '--', 'site/index.html');
    await writeFile(path.join(directory, 'site', 'index.html'), '<p>Public</p>');
    assert.throws(runGuard, (error) => error.stderr.toString('utf8').includes('(index): GitHub token'));

    git('add', '--', 'site/index.html');
    const changed = Buffer.from(jpegFixture);
    changed[7] = 1;
    await writeFile(path.join(directory, 'site', 'assets', 'photo.jpg'), changed);
    git('add', '--', 'site/assets/photo.jpg');
    await writeFile(path.join(directory, 'site', 'assets', 'photo.jpg'), jpegFixture);
    assert.throws(runGuard, (error) => error.stderr.toString('utf8').includes('(index): index media differs'));
  } finally {
    assert.equal(path.dirname(path.resolve(directory)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.match(path.basename(directory), /^luquisound-index-/);
    await rm(directory, { recursive: true, force: true });
  }
});
