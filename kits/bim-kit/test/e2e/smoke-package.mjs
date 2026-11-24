// Packs the built bim-kit and the SDK root (its peer) to temporary tarballs,
// checks the bim-kit tarball's contents, installs both with the peers in a
// clean project, then imports every subpath. Before packing, it checks that
// the built modules import only what the package declares, so a library the
// host shares (such as the router, whose context the host provides) is never
// bundled privately. Modelled on the root tests/e2e/smoke-package.mjs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The versions the bim-kit is developed and tested with, from its package.json.
const PEERS = [
  'react@19.3.0',
  'react-dom@19.3.0',
  'zod@4.6.7',
  'three@0.186.0',
  '@mui/material@9.4.0',
  '@mui/icons-material@9.4.0',
  '@emotion/react@11.14.0',
  '@emotion/styled@11.14.1',
  'react-router-dom@7.18.4',
];

// Install scripts of unvetted transitive versions must not run.
const ADD = ['add', '--silent', '--ignore-scripts'];

// Only the router's own copy says this, so finding it means it was bundled.
const BUNDLED_ROUTER = 'React Router caught the following error during render';

// `from 'x'`, `import 'x'` and `import('x')`, as tsc writes them.
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"'\s]+)["']/g;

const ALLOWED =
  /^package\/(package\.json|README\.md|LICENSE\.md|CHANGELOG\.md|THIRD-PARTY-NOTICES\.md|dist\/esm\/.+\.(js|d\.ts))$/;

// The file behind each subpath of the exports map.
const ENTRIES = [
  'index',
  'schema',
  'converter',
  'viewer/index',
  'react/index',
  'react/BimCanvas',
  'dtaas/index',
];

const REQUIRED = [
  ...['README.md', 'LICENSE.md', 'CHANGELOG.md', 'THIRD-PARTY-NOTICES.md'].map(
    (file) => `package/${file}`,
  ),
  ...ENTRIES.flatMap((entry) => [`package/dist/esm/${entry}.js`, `package/dist/esm/${entry}.d.ts`]),
];

// Argument arrays, no shell. The output stays visible to diagnose a failure.
const yarn = (args, cwd) => execFileSync('yarn', args, { cwd, stdio: 'inherit' });

const manifestOf = (directory) => JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));

const checkTarball = (archive) => {
  // Regular files only: their verbose listing starts with '-'.
  const files = execFileSync('tar', ['-tvzf', archive], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.startsWith('-'))
    .map((line) => line.split(/\s+/).pop());
  const unexpected = files.filter((file) => !ALLOWED.test(file));
  const missing = REQUIRED.filter((file) => !files.includes(file));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Tarball check failed. Unexpected: ${unexpected.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}.`,
    );
  }
};

const packageOf = (specifier) =>
  specifier
    .split('/')
    .slice(0, specifier.startsWith('@') ? 2 : 1)
    .join('/');

const isBare = (specifier) =>
  !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('node:');

const readChunks = (dist) =>
  readdirSync(dist, { recursive: true })
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({ file, code: readFileSync(join(dist, file), 'utf8') }));

// Every bare import in dist names the package itself, a dependency or a peer,
// and the router is not inlined.
const checkDist = (bimRoot) => {
  const manifest = manifestOf(bimRoot);
  const declared = new Set([
    manifest.name,
    ...Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }),
  ]);
  const chunks = readChunks(join(bimRoot, 'dist'));
  const undeclared = chunks.flatMap(({ file, code }) =>
    [...code.matchAll(SPECIFIER)]
      .map((match) => match[1])
      .filter((spec) => isBare(spec) && !declared.has(packageOf(spec)))
      .map((spec) => `${file}: ${spec}`),
  );
  const bundled = chunks
    .filter(({ code }) => code.includes(BUNDLED_ROUTER))
    .map(({ file }) => file);
  if (undeclared.length > 0 || bundled.length > 0) {
    throw new Error(
      `Dist check failed. Undeclared imports: ${undeclared.join(', ') || 'none'}. Bundled router in: ${bundled.join(', ') || 'none'}.`,
    );
  }
};

// Each subpath's most telling export, plus the dtaas extension validated
// through the real SDK instead of a hand-rolled shape check.
const importScript = (bimName, sdkName) => `
import assert from 'node:assert/strict';
const core = await import('${bimName}');
assert.equal(core.normaliseLibraryPath('a/../b'), null);
const schema = await import('${bimName}/schema');
assert.equal(schema.readManifest({}).ok, false);
const converter = await import('${bimName}/converter');
assert.equal(typeof converter.convertIfc, 'function');
const viewer = await import('${bimName}/viewer');
assert.equal(typeof viewer.SceneView, 'function');
const react = await import('${bimName}/react');
assert.equal(typeof react.BuildingModels, 'function');
const canvas = await import('${bimName}/react/canvas');
assert.equal(typeof canvas.default, 'function');
const dtaas = await import('${bimName}/dtaas');
assert.equal(dtaas.extension.id, 'bim');
const sdk = await import('${sdkName}');
assert.equal(sdk.validateExtension(dtaas.extension).valid, true);
`;

const packTo = (sourceDirectory, directory, name) => {
  const archive = join(directory, `${name}.tgz`);
  yarn(['pack', '--filename', archive], sourceDirectory);
  return archive;
};

const installEverything = (directory, bimArchive, sdkArchive) => {
  yarn(['init', '-y'], directory);
  yarn([...ADD, `file:${bimArchive}`, `file:${sdkArchive}`, ...PEERS], directory);
};

const importEverything = (directory, bimRoot, sdkRoot) => {
  const script = importScript(manifestOf(bimRoot).name, manifestOf(sdkRoot).name);
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: directory,
    stdio: 'inherit',
  });
};

const runSmokeTest = () => {
  // The bim-kit folder and the SDK root, from this file and not from the
  // current directory.
  const bimRoot = resolve(import.meta.dirname, '..', '..');
  const sdkRoot = resolve(bimRoot, '..', '..');
  const directory = mkdtempSync(join(tmpdir(), 'bim-kit-smoke-'));
  try {
    checkDist(bimRoot);
    const bimArchive = packTo(bimRoot, directory, 'bim');
    checkTarball(bimArchive);
    const sdkArchive = packTo(sdkRoot, directory, 'sdk');
    installEverything(directory, bimArchive, sdkArchive);
    importEverything(directory, bimRoot, sdkRoot);
    process.stdout.write('Package smoke test passed\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

runSmokeTest();
