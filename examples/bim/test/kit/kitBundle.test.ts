import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as react from 'react';
import * as reactJsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import * as reactRouterDom from 'react-router-dom';
import * as muiMaterial from '@mui/material';
import * as zod from 'zod';
import * as dtaasSdk from '@into-cps-association/dtaas-sdk';
import * as dtaasSdkSchema from '@into-cps-association/dtaas-sdk/schema';
import { checkConformance, fakeHostServices } from '@into-cps-association/dtaas-sdk/testing';
import {
  DEPLOYED_EXTENSIONS_GLOBAL,
  SHARED_MODULES_GLOBAL,
  validateExtension,
  type DtaasExtension,
} from '@into-cps-association/dtaas-sdk';

// The modules the host shares, by their keys under DTAAS_SHARED.
const SHARED = {
  react,
  reactJsxRuntime,
  reactDom,
  reactRouterDom,
  muiMaterial,
  dtaasSdk,
  dtaasSdkSchema,
  zod,
};

type Registered = Record<string, { extension: DtaasExtension }>;

const root = path.join(__dirname, '../..');
const out = mkdtempSync(path.join(tmpdir(), 'bim-kit-'));
const bundle = path.join(out, 'index.js');

afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Run the bundle as the browser would and return what it registered. */
function evaluate(): Registered {
  const window: Record<string, unknown> = {};
  // A classic script runs with `this` as the window. The Function constructor
  // runs the bundle the same way, with the shared modules as its one global.
  // eslint-disable-next-line no-new-func
  new Function(SHARED_MODULES_GLOBAL, readFileSync(bundle, 'utf-8')).call(window, SHARED);
  return window[DEPLOYED_EXTENSIONS_GLOBAL] as Registered;
}

describe('the deployed bundle', () => {
  let registered: Registered;

  beforeAll(() => {
    execFileSync('yarn', ['build:kit'], {
      cwd: root,
      env: { ...process.env, DTAAS_KIT_OUT: out },
      stdio: 'pipe',
    });
    registered = evaluate();
  }, 300_000);

  it('is one script that takes the shared modules from the host', () => {
    const code = readFileSync(bundle, 'utf-8');
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.react`);
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.muiMaterial`);
  });

  // The aec substrate draws its controls as plain DOM and starts no React
  // root, so the bundle carries no CommonJS copy of react-dom/client, whose
  // require('react') a browser cannot run.
  it('carries no CommonJS require, which a browser lacks', () => {
    expect(readFileSync(bundle, 'utf-8')).not.toContain('require(');
  });

  it('registers the extension bim with its aec substrate', () => {
    expect(Object.keys(registered)).toEqual(['bim']);
    const { extension } = registered.bim;
    expect(validateExtension(extension)).toEqual({ valid: true, errors: [] });
    expect(extension.visualisation?.substrates?.map(({ id }) => id)).toEqual(['aec']);
  });

  it('mounts its pages through the host it is given', async () => {
    const host = fakeHostServices({ extensionId: 'bim' });
    await expect(
      checkConformance(registered.bim.extension, { host, timeoutMs: 10_000 }),
    ).resolves.toEqual({ passed: true, errors: [] });
  });
});
