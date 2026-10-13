import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileContentIssues, indexedContentIssues, manifestIssues, mediaFileSizeLimit,
  pathIssues, readPublicBytes } from './public-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8'));
const errors = manifestIssues(files);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const gitBytes = (file, sizeLimit) => execFileSync('git', ['show', `:${file}`], {
  cwd: root, maxBuffer: sizeLimit + 1,
});
const indexed = git('ls-files', '--cached', '-z').split('\0').filter(Boolean);
const visible = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
const approved = new Set(files);
for (const file of new Set([...indexed, ...visible])) {
  if (!approved.has(file)) errors.push(`${JSON.stringify(file)}: not approved for publication`);
  for (const issue of pathIssues(file)) errors.push(`${JSON.stringify(file)}: ${issue}`);
}
// Validate candidate files before the first commit and all approved files in CI.
for (const file of files) {
  try {
    const target = path.join(root, file);
    const sizeLimit = mediaFileSizeLimit(file) ?? 256 * 1024;
    const bytes = await readPublicBytes(target, sizeLimit);
    for (const issue of fileContentIssues(file, bytes)) errors.push(`${JSON.stringify(file)}: ${issue}`);
    // The index can differ from the working copy during a commit review.
    if (indexed.includes(file)) {
      const staged = gitBytes(file, sizeLimit);
      for (const issue of indexedContentIssues(file, staged, bytes)) errors.push(`${JSON.stringify(file)} (index): ${issue}`);
      const entry = git('ls-files', '--stage', '--', file);
      if (!entry.startsWith('100644 ') && !entry.startsWith('100755 ')) {
        errors.push(`${JSON.stringify(file)}: index must contain a regular file`);
      }
    }
    if (['.mjs', '.js'].includes(path.extname(file))) execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
    if (path.extname(file) === '.json') JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    errors.push(`${JSON.stringify(file)}: missing, linked, oversized, invalid text, invalid syntax or unreadable index`);
  }
}
if (indexed.length) {
  for (const file of files) if (!indexed.includes(file)) errors.push(`${JSON.stringify(file)}: missing from index`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Public boundary passed: ${files.length} approved files; ${indexed.length} indexed files.`);
console.log('Manual privacy review and GitHub secret protection are still required.');
