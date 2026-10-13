import path from 'node:path';

const textExtensions = new Set(['.md', '.mjs', '.json', '.yml']);
const rootFiles = new Set(['.gitignore', '.gitattributes', '.editorconfig', '.github/CODEOWNERS']);
const credentialPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['credential in URL', /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i],
  ['Windows local path', /\b[A-Za-z]:[\\/][A-Za-z0-9]/],
  ['Unix home path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
];

export function pathIssues(file) {
  const parts = file.split('/');
  const issues = [];
  if (!file || file.includes('\\') || file.startsWith('/') || parts.some((p) => !p || p === '.' || p === '..')) {
    issues.push('non-canonical relative path');
  }
  if (parts.some((p) => p.toLowerCase().startsWith('.env') || /(?:^|\.)local(?:\.|$)/i.test(p))) {
    issues.push('local configuration or environment file');
  }
  if (parts.some((p) => /^(?:node_modules|\.git|\.codex.*|\.agent-tmp|01-immersive|03-gallery)$/i.test(p))) {
    issues.push('private or generated directory');
  }
  if (parts.some((p) => /^provenance\.md$/i.test(p))) issues.push('private provenance');
  if (!rootFiles.has(file) && !textExtensions.has(path.posix.extname(file))) issues.push('unapproved file type');
  return issues;
}

export function contentIssues(content) {
  const issues = [];
  if (content.includes('\0')) issues.push('binary content');
  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(content)) issues.push(label);
  }
  return issues;
}

export function manifestIssues(files) {
  if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== 'string')) {
    return ['manifest must be a non-empty array of paths'];
  }
  const issues = files.flatMap((file) => pathIssues(file).map((issue) => `${JSON.stringify(file)}: ${issue}`));
  if (new Set(files).size !== files.length) issues.push('duplicate manifest entry');
  if (!files.includes('public-files.json')) issues.push('manifest must include itself');
  return issues;
}
