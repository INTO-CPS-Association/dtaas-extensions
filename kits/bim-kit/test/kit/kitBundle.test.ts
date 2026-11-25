import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as react from 'react';
import * as reactJsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import * as reactDomClient from 'react-dom/client';
import * as reactRouterDom from 'react-router-dom';
import * as muiMaterial from '@mui/material';
import * as zod from 'zod';
import * as dtaasExtensions from '@into-cps-association/dtaas-extensions';
import * as dtaasExtensionsSchema from '@into-cps-association/dtaas-extensions/schema';
import {
  checkConformance,
  fakeHostServices,
  runDeployedBundle,
  type DeployedRegistry,
} from '@into-cps-association/dtaas-extensions/testing';
import { SHARED_MODULES_GLOBAL, validateExtension } from '@into-cps-association/dtaas-extensions';

// The modules the host shares, by their keys under DTAAS_SHARED.
const SHARED = {
  react,
  reactJsxRuntime,
  reactDom,
  reactDomClient,
  reactRouterDom,
  muiMaterial,
  dtaasExtensions,
  dtaasExtensionsSchema,
  zod,
};

const root = path.join(__dirname, '../..');
const out = mkdtempSync(path.join(tmpdir(), 'bim-kit-'));
const bundle = path.join(out, 'index.js');

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('the deployed bundle', () => {
  let registered: DeployedRegistry;

  beforeAll(() => {
    execFileSync('yarn', ['build:kit'], {
      cwd: root,
      env: { ...process.env, DTAAS_KIT_OUT: out },
      stdio: 'pipe',
    });
    registered = runDeployedBundle(readFileSync(bundle, 'utf-8'), SHARED);
  }, 300_000);

  it('is one script that takes the shared modules from the host', () => {
    const code = readFileSync(bundle, 'utf-8');
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.react`);
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.muiMaterial`);
  });

  // The aec substrate starts its React root with the host's react-dom/client,
  // so the bundle carries no CommonJS copy of it, whose require('react') a
  // browser cannot run.
  it('carries no CommonJS require, which a browser lacks', () => {
    const code = readFileSync(bundle, 'utf-8');
    expect(code).not.toContain('require(');
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.reactDomClient`);
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
