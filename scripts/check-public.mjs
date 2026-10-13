import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentIssues, manifestIssues, pathIssues } from './public-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8'));
const errors = manifestIssues(files);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
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
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('must be a regular file');
    const resolved = await realpath(target);
    if (resolved.toLowerCase() !== target.toLowerCase()) throw new Error('linked paths are prohibited');
    if (info.size > 256 * 1024) throw new Error('file exceeds infrastructure size limit');
    const bytes = await readFile(target);
    const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    for (const issue of contentIssues(content)) errors.push(`${JSON.stringify(file)}: ${issue}`);
    // The index can differ from the working copy during a commit review.
    if (indexed.includes(file)) {
      const staged = git('show', `:${file}`);
      for (const issue of contentIssues(staged)) errors.push(`${JSON.stringify(file)} (index): ${issue}`);
      const entry = git('ls-files', '--stage', '--', file);
      if (!entry.startsWith('100644 ') && !entry.startsWith('100755 ')) {
        errors.push(`${JSON.stringify(file)}: index must contain a regular file`);
      }
    }
    if (['.mjs'].includes(path.extname(file))) execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
    if (path.extname(file) === '.json') JSON.parse(content);
  } catch {
    errors.push(`${JSON.stringify(file)}: missing, linked, oversized, invalid UTF-8 or invalid syntax`);
  }
}
if (indexed.length) {
  for (const file of files) if (!indexed.includes(file)) errors.push(`${JSON.stringify(file)}: missing from index`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Public boundary passed: ${files.length} approved infrastructure files; ${indexed.length} indexed files.`);
console.log('Manual privacy review and GitHub secret protection are still required.');
