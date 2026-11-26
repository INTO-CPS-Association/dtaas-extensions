// `yarn contract` in a kit: builds and packs the contract at the root of this
// repository, then unpacks the tarball where Node resolves the kit's peer, so
// the kit is tested against this contract installed the way any consumer installs
// it. A `file:` dependency would copy the whole repository (a second React) or
// fail yarn's integrity check on every rebuild.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const kit = process.cwd();

// Run from a kit folder only, so the script never replaces the contract somewhere else.
const manifest = join(kit, 'package.json');
const isKit =
  dirname(kit) === join(root, 'kits') &&
  existsSync(manifest) &&
  JSON.parse(readFileSync(manifest, 'utf-8')).dtaas?.id;
if (!isKit) {
  process.stderr.write(
    `Run yarn contract inside a folder of ${join(root, 'kits')}.\n`,
  );
  process.exit(2);
}

const target = join(kit, 'node_modules/@into-cps-association/dtaas-extensions');
const work = mkdtempSync(join(tmpdir(), 'dtaas-extensions-'));
const tarball = join(work, 'contract.tgz');
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });

try {
  run('yarn', ['build']);
  run('yarn', ['pack', '--filename', tarball]);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', target, '--strip-components=1']);
} finally {
  rmSync(work, { recursive: true, force: true });
}
