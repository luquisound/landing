import path from 'node:path';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';

const textExtensions = new Set(['.md', '.mjs', '.json', '.yml']);
const rootFiles = new Set(['.gitignore', '.gitattributes', '.editorconfig', '.github/CODEOWNERS']);
const frontendPath = /^site\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:html|css|js)$/;
const mediaPath = /^site\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|mp4)$/;
const textSizeLimit = 256 * 1024;
const imageSizeLimit = 8 * 1024 * 1024;
const videoSizeLimit = 35 * 1024 * 1024;
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

export function mediaFileSizeLimit(file) {
  if (!mediaPath.test(file)) return undefined;
  return path.posix.extname(file) === '.mp4' ? videoSizeLimit : imageSizeLimit;
}

export async function readPublicBytes(target, sizeLimit = textSizeLimit) {
  if (!Number.isSafeInteger(sizeLimit) || sizeLimit < 0 || sizeLimit > videoSizeLimit) {
    throw new Error('invalid public file size limit');
  }
  // O_NOFOLLOW is unavailable on Windows; realpath still rejects redirected paths.
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('must be a regular file');
    if (info.size > sizeLimit) throw new Error('file exceeds publication size limit');
    const resolved = await realpath(target);
    const expected = path.resolve(target);
    const normalize = (file) => process.platform === 'win32' ? file.toLowerCase() : file;
    if (normalize(resolved) !== normalize(expected)) throw new Error('linked paths are prohibited');
    // A bounded descriptor read also contains a file that grows after stat().
    const bytes = Buffer.alloc(sizeLimit + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    if (length > sizeLimit) throw new Error('file exceeds publication size limit');
    return bytes.subarray(0, length);
  } finally {
    await handle.close();
  }
}

export async function readPublicFile(target) {
  return new TextDecoder('utf-8', { fatal: true }).decode(await readPublicBytes(target));
}

export function mediaIssues(file, bytes) {
  const sizeLimit = mediaFileSizeLimit(file);
  if (sizeLimit === undefined) return ['unapproved media path'];
  if (!Buffer.isBuffer(bytes)) return ['media must be binary bytes'];
  if (bytes.length > sizeLimit) return ['media exceeds publication size limit'];
  const extension = path.posix.extname(file);
  if (extension === '.jpg') {
    if (bytes.length < 4 || !bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      || !bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return ['invalid JPEG signature'];
    let offset = 2;
    let scan = false;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) {
        if (scan) continue;
        return ['invalid JPEG segment'];
      }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (scan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
      if ([0xe1, 0xed, 0xfe].includes(marker)) return ['embedded JPEG metadata'];
      if (marker === 0xd9) {
        if (offset !== bytes.length) return ['invalid JPEG segment'];
        break;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return ['invalid JPEG segment'];
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) return ['invalid JPEG segment'];
      scan = marker === 0xda;
      offset += length;
    }
  } else if (extension === '.png') {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const end = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    if (bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)
      || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR'
      || bytes.readUInt32BE(16) === 0 || bytes.readUInt32BE(20) === 0
      || !bytes.subarray(-12).equals(end)) return ['invalid PNG signature'];
    let offset = 8;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) return ['invalid PNG chunk'];
      const length = bytes.readUInt32BE(offset);
      if (offset + length + 12 > bytes.length) return ['invalid PNG chunk'];
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(type)) return ['embedded PNG metadata'];
      offset += length + 12;
    }
  } else {
    const brands = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ']);
    if (bytes.length < 24 || bytes.toString('ascii', 4, 8) !== 'ftyp'
      || bytes.readUInt32BE(0) < 16 || bytes.readUInt32BE(0) > bytes.length
      || !brands.has(bytes.toString('ascii', 8, 12))) return ['invalid MP4 signature'];
  }
  return [];
}

export function fileContentIssues(file, bytes) {
  if (mediaFileSizeLimit(file) !== undefined) return mediaIssues(file, bytes);
  if (bytes.length > textSizeLimit) return ['text exceeds publication size limit'];
  try {
    return contentIssues(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return ['invalid UTF-8'];
  }
}

export function indexedContentIssues(file, staged, working) {
  const issues = fileContentIssues(file, staged);
  if (mediaFileSizeLimit(file) !== undefined && !staged.equals(working)) {
    issues.push('index media differs from the reviewed working copy');
  }
  return issues;
}

export function pathIssues(file) {
  const parts = file.split('/');
  const issues = [];
  if (!file || file.includes('\\') || /[\x00-\x1f<>:"|?*\[\]{}]/.test(file) || file.startsWith('/')
    || parts.some((p) => !p || p === '.' || p === '..')) {
    issues.push('non-canonical relative path');
  }
  if (parts.some((p) => p.toLowerCase().startsWith('.env') || /(?:^|\.)local(?:\.|$)/i.test(p))) {
    issues.push('local configuration or environment file');
  }
  if (parts.some((p) => /^(?:node_modules|\.git|\.codex.*|\.agent-tmp|\.vercel|01-immersive|03-gallery|library)$/i.test(p))) {
    issues.push('private or generated directory');
  }
  if (parts.some((p) => /^provenance\.md$/i.test(p))) issues.push('private provenance');
  const approvedFrontend = frontendPath.test(file) || mediaPath.test(file);
  const infrastructure = !parts.some((part) => part.toLowerCase() === 'site')
    && (rootFiles.has(file) || textExtensions.has(path.posix.extname(file)));
  if (!approvedFrontend && !infrastructure) issues.push('unapproved file type or publication location');
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
