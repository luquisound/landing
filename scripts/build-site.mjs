import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileContentIssues, manifestIssues, mediaFileSizeLimit, pathIssues,
  readPublicBytes } from './public-policy.mjs';
import { STATIC_ASSET_HEADERS } from './site-worker.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function buildSite({ root = repositoryRoot, output = path.join(root, 'dist') } = {}) {
  const manifest = JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8'));
  const issues = manifestIssues(manifest);
  if (issues.length) throw new Error(issues.join('\n'));
  const files = manifest.filter((file) => file.startsWith('site/'));
  if (!files.includes('site/index.html')) throw new Error('The approved site needs index.html.');

  // Refuse existing output so an old bundle or unrelated file cannot be published.
  try {
    await mkdir(output);
  } catch (error) {
    if (error.code === 'EEXIST') error.message = 'The output directory already exists; choose a fresh directory.';
    throw error;
  }
  const assets = path.join(output, 'site');
  const videoLengths = {};
  let bytesWritten = 0;
  for (const file of files) {
    const problems = pathIssues(file);
    if (problems.length) throw new Error(`${file}: ${problems.join(', ')}`);
    const bytes = await readPublicBytes(path.join(root, ...file.split('/')), mediaFileSizeLimit(file));
    const contentProblems = fileContentIssues(file, bytes);
    if (contentProblems.length) throw new Error(`${file}: ${contentProblems.join(', ')}`);
    const relative = file.slice('site/'.length);
    const target = path.join(assets, ...relative.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
    if (path.extname(file) === '.mp4') videoLengths[`/${relative}`] = bytes.length;
    bytesWritten += bytes.length;
  }
  const headers = '/*\n' + Object.entries(STATIC_ASSET_HEADERS)
    .map(([name, value]) => `  ${name}: ${value}\n`).join('');
  await writeFile(path.join(assets, '_headers'), headers, { flag: 'wx' });
  let workerImport = path.relative(output, path.join(root, 'scripts', 'site-worker.mjs')).split(path.sep).join('/');
  if (!workerImport.startsWith('.')) workerImport = `./${workerImport}`;
  const worker = `import worker from ${JSON.stringify(workerImport)};\n`
    + `const videoLengths = ${JSON.stringify(videoLengths)};\n`
    + 'export default { fetch(request, env, context) {\n'
    + '  return worker.fetch(request, { ...env, VIDEO_LENGTHS: videoLengths }, context);\n'
    + '} };\n';
  await writeFile(path.join(output, 'worker.mjs'), worker, { flag: 'wx' });
  return { output: path.resolve(output), assets: path.resolve(assets), files: files.length, bytes: bytesWritten };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Usage: node scripts/build-site.mjs [fresh-output-directory]');
  const result = await buildSite(process.argv[2] ? { output: path.resolve(process.argv[2]) } : {});
  console.log(`Prepared ${result.files} approved files (${result.bytes} bytes) in ${result.output}.`);
}
