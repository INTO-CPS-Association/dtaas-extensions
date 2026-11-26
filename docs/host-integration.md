# Integrating the Contract into a Host

This guide is for the DTaaS client (`dtaas-web`) or any other platform that
loads DTaaS extensions. It covers what the contract provides to a host; the host's
own registry (`createExtensionHost`) and service implementations are
described in the architecture proposal (§8).

## The extension manifest

```ts
// src/extensions.ts
import type { DtaasExtension } from '@into-cps-association/dtaas-extensions';
import { extension as bim } from '@into-cps-association/bim-kit/dtaas';

export const extensions: readonly DtaasExtension[] = [bim];
```

## Validating and filtering extensions

```ts
import {
  isExtensionDisabled,
  readExtensionConfig,
  validateExtension,
} from '@into-cps-association/dtaas-extensions';

const env = globalThis.env ?? {};

const enabled = extensions.filter((ext) => {
  if (isExtensionDisabled(ext.id, env)) return false;
  const { valid, errors } = validateExtension(ext);
  if (!valid) logger.error(`Extension ${ext.id} disabled`, errors);
  const config =
    ext.config && readExtensionConfig(ext.id, ext.config.schema, env);
  if (config && !config.success)
    logger.error(`Invalid config for ${ext.id}`, config.error);
  return valid && (config?.success ?? true);
});
```

`validateExtension` checks one extension and never throws. Rules that span
extensions stay in the host's registry:

- duplicate extension ids across kits;
- duplicate anchor kinds, preset ids and substrate ids across kits;
- route collisions with host routes the default `RESERVED_EXTENSION_IDS`
  does not list (pass `{ reservedIds }` to override).

## Providing host services

Create **one `HostServices` per extension**, so that `config()` reads that
extension's `REACT_APP_EXT_<ID>_*` keys, and wrap the extension's elements in
`HostProvider`:

```tsx
import { HostProvider } from '@into-cps-association/dtaas-extensions';

const servicesFor = (ext: DtaasExtension): HostServices => ({
  ...sharedServices,
  config: (schema) => {
    const result = readExtensionConfig(ext.id, schema, env);
    if (!result.success) throw result.error;
    return result.data;
  },
});

<HostProvider services={servicesFor(ext)}>
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
</HostProvider>;
```

Call each extension's `setup(servicesFor(ext))` once, after the store exists.
Mount its `reducer` at `state.ext.<id>`.

The host owns `auth`, `library`, `contents`, `git`, `ui`, `logger`,
`settings` and `config`. The common core owns `signals` and `viz`, and the
host only instantiates it with endpoints from `env.js`.

### Connection status

`signals.connection` is required. `get(paths)` returns the worst state of the
transports serving those paths; a path no transport serves is `down`.
`get([])` is `live`, but `get()` with no transports at all is `down`. Use
`worstConnectionState` to aggregate several states the same way. `use()` must
re-render when the state changes.

## Mounting extension routes

The host mounts each extension's routes at `/<id>/*`, so a kit may use
nested relative `<Routes>` to define its route hierarchy.

## Validating `visualisation.json`

```ts
import { readVisualisationAsset } from '@into-cps-association/dtaas-extensions/schema';

// The origins come from the deployment's configuration, never from the asset.
const result = readVisualisationAsset(bytes, { allowedOrigins });
if (!result.success) ui.snackbar(result.error.issues[0].message, 'error');
```

`readVisualisationAsset` refuses a file over 1 MiB before parsing it, parses the JSON, checks the schema and refuses a transport whose origin is not in `allowedOrigins`. A host never attaches its session tokens or other credentials to a request to an origin the asset names.

## Jest in a CommonJS host

The package is published as ESM only. That is deliberate: a dual ESM/CJS package
could load two copies of the React context behind `useHost()`. A host whose
Jest runs ts-jest in CommonJS mode must let Jest transform the package:

```json
{
  "transformIgnorePatterns": [
    "/node_modules/(?!(@into-cps-association/dtaas-extensions)/).+\\.js$"
  ],
  "transform": {
    "^.+\\.[jt]sx?$": ["ts-jest", { "tsconfig": { "allowJs": true } }]
  }
}
```

## Bundle impact

The root entry imports `react` and `semver`. `./core` imports `semver` and no React. `./schema` (zod), `./testing` and `./eslint` are separate entries and are not bundled unless imported.
