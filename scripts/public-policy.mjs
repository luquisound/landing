import path from 'node:path';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';

const textExtensions = new Set(['.md', '.mjs', '.json', '.yml']);
const rootFiles = new Set(['.gitignore', '.gitattributes', '.editorconfig', '.github/CODEOWNERS']);
const frontendPath = /^site\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:html|css|js)$/;
const mediaPath = /^site\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|mp4)$/;
const vectorPaths = new Set(['site/assets/logo.svg', 'site/assets/logo-vertical.svg',
  'site/assets/monogram.svg', 'site/assets/favicon.svg']);
const fontPaths = new Set(['site/assets/pliant-bold-expanded.woff2', 'site/assets/barlow-regular.woff2']);
const licensePaths = new Set(['site/assets/pliant-license.txt', 'site/assets/barlow-license.txt']);
const textSizeLimit = 256 * 1024;
const fontSizeLimit = 1024 * 1024;
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
  if (fontPaths.has(file)) return fontSizeLimit;
  if (vectorPaths.has(file) || licensePaths.has(file)) return textSizeLimit;
  if (!mediaPath.test(file)) return undefined;
  return path.posix.extname(file) === '.mp4' ? videoSizeLimit : imageSizeLimit;
}

function vectorIssues(content) {
  // Public logos use a closed, passive subset; original editor SVGs stay private.
  if (/[&]|<\s*[!?]/.test(content)) return ['SVG entities, declarations and comments are prohibited'];
  const tokens = content.match(/<[^>]*>|[^<]+/g) ?? [];
  if (tokens.join('') !== content) return ['invalid SVG markup'];
  const stack = [];
  let root = false;
  let paths = 0;
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (token.trim()) return ['SVG text is prohibited'];
      continue;
    }
    const tag = /^<(\/?)(svg|g|path)\b([^<>]*?)(\/?)>$/.exec(token);
    if (!tag) return ['unapproved SVG element'];
    const [, closing, name, rawAttributes, selfClosing] = tag;
    if (closing) {
      if (selfClosing || rawAttributes.trim() || stack.pop() !== name) return ['invalid SVG nesting'];
      continue;
    }
    if (name === 'svg') {
      if (root || stack.length) return ['SVG must have one root'];
      root = true;
    } else if (stack.length === 0 || stack.at(-1) === 'path') return ['invalid SVG nesting'];
    const attributes = new Map();
    let remaining = rawAttributes;
    while (remaining.trim()) {
      const attribute = /^\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(["'])([^"'<>]*)\2/.exec(remaining);
      if (!attribute || attributes.has(attribute[1])) return ['invalid SVG attributes'];
      attributes.set(attribute[1], attribute[3]);
      remaining = remaining.slice(attribute[0].length);
    }
    const numeric = /^[\d.eE+,\s-]+$/;
    for (const [key, value] of attributes) {
      const valid = (key === 'xmlns' && name === 'svg' && value === 'http://www.w3.org/2000/svg')
        || (key === 'viewBox' && name === 'svg' && value.trim().split(/[\s,]+/).length === 4
          && numeric.test(value) && value.trim().split(/[\s,]+/).every((part) => Number.isFinite(Number(part)))
          && value.trim().split(/[\s,]+/).slice(2).every((part) => Number(part) > 0))
        || (['width', 'height'].includes(key) && name === 'svg' && /^\d+(?:\.\d+)?$/.test(value) && Number(value) > 0)
        || (key === 'fill' && /^(?:#[\da-fA-F]{3}(?:[\da-fA-F]{3})?|none)$/.test(value))
        || (['fill-rule', 'clip-rule'].includes(key) && /^(?:evenodd|nonzero)$/.test(value))
        || (key === 'd' && name === 'path' && /^[Mm]/.test(value) && /^[MmZzLlHhVvCcSsQqTtAa\d.eE+,\s-]+$/.test(value))
        || (key === 'transform' && /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d.eE+,\s-]+\)\s*)+$/.test(value));
      if (!valid) return ['unapproved SVG attribute or value'];
    }
    if (name === 'svg' && (!attributes.has('xmlns') || !attributes.has('viewBox'))) return ['SVG root needs xmlns and viewBox'];
    if (name === 'path') {
      if (!attributes.has('d')) return ['SVG path needs geometry'];
      paths += 1;
    }
    if (!selfClosing) stack.push(name);
  }
  return root && paths && stack.length === 0 ? [] : ['incomplete SVG document'];
}

function fontIssues(bytes) {
  if (bytes.length < 48 || bytes.toString('ascii', 0, 4) !== 'wOF2') return ['invalid WOFF2 signature'];
  const flavor = bytes.readUInt32BE(4);
  const tables = bytes.readUInt16BE(12);
  const compressed = bytes.readUInt32BE(20);
  const sfntSize = bytes.readUInt32BE(16);
  if (![0x00010000, 0x4f54544f].includes(flavor) || bytes.readUInt32BE(8) !== bytes.length
    || tables === 0 || bytes.readUInt16BE(14) !== 0 || compressed === 0
    || sfntSize < 12 + tables * 16 || sfntSize > 16 * 1024 * 1024
    || 48 + tables * 2 + compressed > bytes.length) return ['invalid WOFF2 header or bounds'];
  if (bytes.subarray(28, 48).some((byte) => byte !== 0)) return ['WOFF2 metadata and private blocks are prohibited'];
  let offset = 48;
  const readLength = () => {
    let value = 0;
    for (let count = 0; count < 5; count += 1) {
      if (offset >= bytes.length) throw new Error('truncated directory');
      const byte = bytes[offset++];
      if ((count === 0 && byte === 0x80) || value > 0x1ffffff) throw new Error('invalid length');
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error('invalid length');
  };
  try {
    for (let table = 0; table < tables; table += 1) {
      if (offset >= bytes.length) throw new Error('truncated directory');
      const flags = bytes[offset++];
      const index = flags & 0x3f;
      let tag = index === 10 ? 'glyf' : index === 11 ? 'loca' : '';
      if (index === 63) {
        if (offset + 4 > bytes.length) throw new Error('truncated tag');
        tag = bytes.toString('ascii', offset, offset + 4);
        offset += 4;
      }
      if (readLength() > 16 * 1024 * 1024) throw new Error('oversized table');
      const transformed = ['glyf', 'loca'].includes(tag) ? (flags >> 6) !== 3 : (flags >> 6) !== 0;
      if (transformed && readLength() > 16 * 1024 * 1024) throw new Error('oversized table');
    }
  } catch {
    return ['invalid WOFF2 directory'];
  }
  const end = offset + compressed;
  if (end > bytes.length || bytes.length - end > 3 || bytes.subarray(end).some((byte) => byte !== 0)) {
    return ['invalid WOFF2 compressed block bounds'];
  }
  return [];
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
  if (fontPaths.has(file)) return fontIssues(bytes);
  if (vectorPaths.has(file) || licensePaths.has(file)) {
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return ['invalid UTF-8']; }
    const issues = contentIssues(content);
    if (vectorPaths.has(file)) issues.push(...vectorIssues(content));
    if (licensePaths.has(file) && (!content.trim() || /[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(content))) {
      issues.push('invalid license text');
    }
    return issues;
  }
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
  const approvedFrontend = frontendPath.test(file) || mediaFileSizeLimit(file) !== undefined;
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
