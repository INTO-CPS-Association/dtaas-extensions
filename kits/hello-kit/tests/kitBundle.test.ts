import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as react from 'react';
import * as reactJsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import * as reactDomClient from 'react-dom/client';
import * as reactRouterDom from 'react-router-dom';
import * as zod from 'zod';
import * as dtaasSdk from '@into-cps-association/dtaas-sdk';
import * as dtaasSdkSchema from '@into-cps-association/dtaas-sdk/schema';
import {
  checkConformance,
  fakeHostServices,
  runDeployedBundle,
  type DeployedRegistry,
} from '@into-cps-association/dtaas-sdk/testing';
import {
  SHARED_MODULES_GLOBAL,
  validateExtension,
} from '@into-cps-association/dtaas-sdk';

// The modules the host shares, by their keys under DTAAS_SHARED. Only those
// the kit imports are needed to run its bundle.
const SHARED = {
  react,
  reactJsxRuntime,
  reactDom,
  reactDomClient,
  reactRouterDom,
  dtaasSdk,
  dtaasSdkSchema,
  zod,
};

const root = path.join(__dirname, '..');
const out = mkdtempSync(path.join(tmpdir(), 'hello-kit-'));
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
  }, 120_000);

  it('is one small script that takes the shared modules from the host', () => {
    const code = readFileSync(bundle, 'utf-8');
    expect(statSync(bundle).size).toBeLessThan(50_000);
    expect(code).toContain(`${SHARED_MODULES_GLOBAL}.react`);
    expect(code).not.toContain('require(');
  });

  it('registers the extension hello', () => {
    expect(Object.keys(registered)).toEqual(['hello']);
    expect(validateExtension(registered.hello.extension)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('mounts its pages through the host it is given', async () => {
    const host = fakeHostServices({
      extensionId: 'hello',
      env: { REACT_APP_EXT_HELLO_GREETING: 'Hej' },
    });
    await expect(
      checkConformance(registered.hello.extension, { host }),
    ).resolves.toEqual({ passed: true, errors: [] });
  });
});
