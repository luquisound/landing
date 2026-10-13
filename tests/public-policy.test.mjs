import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { contentIssues, manifestIssues, pathIssues, readPublicFile } from '../scripts/public-policy.mjs';

test('rejects private, generated, noncanonical and media paths even if added to a manifest', () => {
  for (const file of ['.env', '.env.example', 'docs/project-context.local.md', 'assets/PROVENANCE.md',
    '01-immersive/app.js', '03-gallery/index.html', '.codex/config.json', '.git/config',
    'node_modules/example/package.json', '../README.md', '/README.md', 'docs//a.md',
    'docs\\a.md', 'assets/photo.jpg', 'assets/video.mp4', 'credentials.pem']) {
    assert.ok(pathIssues(file).length > 0, file);
  }
});

test('accepts public infrastructure paths', () => {
  for (const file of ['README.md', '.gitignore', '.github/CODEOWNERS', 'scripts/check-public.mjs', '.github/workflows/ci.yml']) {
    assert.deepEqual(pathIssues(file), []);
  }
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
  } finally {
    if (linked) await unlink(link);
    await unlink(target);
    await rmdir(directory);
  }
});
