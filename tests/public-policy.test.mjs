import assert from 'node:assert/strict';
import test from 'node:test';
import { contentIssues, manifestIssues, pathIssues } from '../scripts/public-policy.mjs';

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
