import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const urlAttributes = new Set(['href', 'src', 'poster', 'data-mobile-source', 'data-desktop-source',
  'data-mobile-poster', 'data-desktop-poster']);
const idAttributes = new Set(['for', 'aria-controls', 'aria-labelledby', 'aria-describedby']);
const words = (value = '') => value.trim().split(/\s+/).filter(Boolean);
const sameValues = (left, right) => [...left].sort().join(' ') === [...right].sort().join(' ');

// This scanner covers the static tags and quoted attributes used by the site.
function htmlTags(source) {
  return [...source.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([a-z][\w-]*)\b([^<>]*?)>/gi)].map(match => {
    const attributes = new Map();
    for (const attribute of match[2].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      attributes.set(attribute[1].toLowerCase(), (attribute[2] ?? attribute[3] ?? attribute[4] ?? '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    }
    return { name: match[1].toLowerCase(), attributes };
  });
}

export async function checkSite({ root = repositoryRoot, manifest } = {}) {
  const approved = new Set(manifest ?? JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8')));
  const issues = [];
  const documents = new Map();
  const sources = new Map();
  const references = [];
  const services = new Set();
  const galleryCards = [];
  const existing = new Map();
  const addReference = (file, value, attribute) => {
    if (!value || /^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(value)) return;
    try {
      const url = new URL(value, `https://site.invalid/${file.slice('site/'.length)}`);
      if (url.origin !== 'https://site.invalid') {
        issues.push(`${file}: unsupported ${attribute} reference ${JSON.stringify(value)}`);
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const target = `site${pathname === '/' ? '/index.html' : pathname}`;
      references.push({ file, value, target, fragment: decodeURIComponent(url.hash.slice(1)), attribute });
    } catch {
      issues.push(`${file}: invalid ${attribute} reference ${JSON.stringify(value)}`);
    }
  };

  for (const file of approved) {
    if (!/^site\/[^/]+\.(?:html|css|js)$/.test(file)) continue;
    try {
      sources.set(file, await readFile(path.join(root, file), 'utf8'));
    } catch {
      issues.push(`${file}: missing or unreadable site source`);
    }
  }

  for (const [file, source] of sources) {
    if (file.endsWith('.html')) {
      const tags = htmlTags(source);
      const ids = new Set();
      const caseIds = new Set();
      const serviceIds = new Set();
      for (const { attributes } of tags) {
        const id = attributes.get('id');
        if (id !== undefined) {
          if (!id || ids.has(id)) issues.push(`${file}: empty or duplicate id ${JSON.stringify(id)}`);
          ids.add(id);
        }
        for (const [attribute, value] of attributes) {
          if (urlAttributes.has(attribute)) addReference(file, value, attribute);
          if (attribute === 'srcset') {
            for (const candidate of value.split(',')) addReference(file, candidate.trim().split(/\s+/)[0], attribute);
          }
        }
        const service = attributes.get('data-open-service');
        if (service !== undefined) {
          if (!service || serviceIds.has(service)) issues.push(`${file}: empty or duplicate service id ${JSON.stringify(service)}`);
          serviceIds.add(service);
          services.add(service);
        }
        const caseId = attributes.get('data-case');
        if (caseId !== undefined) {
          if (!caseId || caseIds.has(caseId)) issues.push(`${file}: empty or duplicate data-case ${JSON.stringify(caseId)}`);
          caseIds.add(caseId);
          galleryCards.push({ file, id: caseId, categories: words(attributes.get('data-category')) });
        }
      }
      documents.set(file, { ids, tags });
    }
    if (file.endsWith('.css') || file.endsWith('.html')) {
      for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
        addReference(file, match[1] ?? match[2] ?? match[3], 'url()');
      }
    }
    if (file.endsWith('.js')) {
      for (const match of source.matchAll(/["'](assets\/[^"'\r\n]+)["']/g)) {
        addReference(file, match[1], 'JavaScript asset');
      }
    }
  }

  for (const [file, { tags, ids }] of documents) {
    for (const { attributes } of tags) {
      for (const [attribute, value] of attributes) {
        if (!idAttributes.has(attribute)) continue;
        for (const id of words(value)) {
          if (!ids.has(id)) issues.push(`${file}: ${attribute} references missing id ${JSON.stringify(id)}`);
        }
      }
    }
  }

  const catalogSource = sources.get('site/cases.js');
  if (catalogSource === undefined) {
    issues.push('site/cases.js: missing approved case catalog');
  } else {
    let cases;
    try {
      // Only the repository's own static catalog is evaluated, without Node/browser capabilities.
      const context = vm.createContext({ window: {} }, { codeGeneration: { strings: false, wasm: false } });
      vm.runInContext(catalogSource, context, { timeout: 100, filename: 'site/cases.js' });
      cases = context.window.LuquisoundCases;
      if (!Array.isArray(cases)) throw new TypeError('Expected a case array.');
    } catch {
      issues.push('site/cases.js: catalog must define a static LuquisoundCases array');
      cases = [];
    }
    const caseIds = new Set();
    for (const entry of cases ?? []) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || caseIds.has(entry.id)) {
        issues.push(`site/cases.js: empty or duplicate case id ${JSON.stringify(entry?.id)}`);
        continue;
      }
      caseIds.add(entry.id);
      const label = `site/cases.js (${entry.id})`;
      for (const field of ['categories', 'serviceRefs']) {
        const values = entry[field];
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !services.has(value)) ||
            new Set(values).size !== values.length || (field === 'categories' && values.length === 0)) {
          issues.push(`${label}: ${field} must contain unique known service ids`);
        }
      }
      if (!Array.isArray(entry.media) || entry.media.length === 0) {
        issues.push(`${label}: media must be a nonempty array`);
      } else {
        for (const medium of entry.media) {
          if (!medium || !['image', 'video'].includes(medium.type) || typeof medium.src !== 'string' || !medium.src) {
            issues.push(`${label}: invalid media type or source`);
            continue;
          }
          addReference('site/cases.js', medium.src, `media source (${entry.id})`);
          if (medium.poster !== undefined) {
            if (typeof medium.poster !== 'string' || !medium.poster) issues.push(`${label}: invalid media poster`);
            else addReference('site/cases.js', medium.poster, `media poster (${entry.id})`);
          }
        }
      }
      const cards = galleryCards.filter(card => card.id === entry.id);
      if (cards.length === 0) issues.push(`${label}: missing gallery card`);
      for (const card of cards) {
        if (!sameValues(card.categories, Array.isArray(entry.categories) ? entry.categories : [])) {
          issues.push(`${card.file}: categories differ from catalog for ${JSON.stringify(entry.id)}`);
        }
      }
    }
    for (const card of galleryCards) {
      if (!caseIds.has(card.id)) issues.push(`${card.file}: unknown data-case ${JSON.stringify(card.id)}`);
    }
  }
  for (const { file, value, target, fragment, attribute } of references) {
    if (!approved.has(target)) {
      issues.push(`${file}: ${attribute} references unapproved path ${JSON.stringify(value)}`);
      continue;
    }
    if (!existing.has(target)) {
      existing.set(target, await stat(path.join(root, target)).then(info => info.isFile(), () => false));
    }
    if (!existing.get(target)) issues.push(`${file}: ${attribute} references missing file ${JSON.stringify(value)}`);
    if (fragment && target.endsWith('.html') && !documents.get(target)?.ids.has(fragment)) {
      issues.push(`${file}: ${attribute} references missing anchor ${JSON.stringify(value)}`);
    }
  }
  return [...new Set(issues)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = await checkSite();
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Site references and case catalog passed.');
  }
}
