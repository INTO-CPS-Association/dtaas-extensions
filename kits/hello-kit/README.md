# hello-kit

The smallest complete DTaaS domain extension. Use it as the template layout
for a new kit.

| Path                            | Role                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| `src/core/`                     | Framework-free domain logic: twin detection, reading format, anchor refs |
| `src/react/Reading.tsx`         | A domain widget that knows nothing about DTaaS                           |
| `src/dtaas/index.ts`            | The `DtaasExtension` the host imports                                    |
| `src/dtaas/pages/HelloPage.tsx` | A lazy page that reads everything through `useHost()`                    |
| `src/dtaas/anchors.ts`          | The `hello-node` anchor kind (`node:<id>` on an `image` substrate)       |
| `src/dtaas/presets/`            | The `hello.warmth` colour-scale preset                                   |
| `src/dtaas/config.ts`           | Schema for `REACT_APP_EXT_HELLO_GREETING`                                |

The SDK's own test suite exercises the kit in
[`tests/integration/helloKit.test.tsx`](../../tests/integration/helloKit.test.tsx),
and
[`tests/integration/exampleKitsLint.test.ts`](../../tests/integration/exampleKitsLint.test.ts)
checks its sources against the SDK's lint rules for kits.

The folder is also a project of its own, with `package.json`,
`tsconfig.json`, `vite.config.ts`, `jest.config.json` and `tests/`, so it can
be copied out of this repository as it is. Its sources use relative imports
only.

| Path               | Role                                                  |
| ------------------ | ----------------------------------------------------- |
| `vite.config.ts`   | Builds the deployed bundle with `kitBuildConfig`      |
| `tests/`           | Checks that the host accepts the kit and mounts pages |
| `jest.config.json` | Compiles the SDK, which is ESM only, for the tests    |

## Start a New Kit From This One

1. Copy this folder into a new repository, for example `wind-kit`.
1. Choose the id of the new extension, such as `wind`. Write it in
   `defineExtension` in `src/dtaas/index.ts`, in `dtaas.id` of
   `package.json` and in the name of the package. The id names the pages
   (`/wind`), the `env.js` keys (`REACT_APP_EXT_WIND_*`) and the folder the
   bundle is deployed to.
1. Rename the anchor kind, the preset and the id in `tests/`.
1. Install and test, with no installation of DTaaS:

   ```bash
   yarn install
   yarn typecheck
   yarn test
   ```

1. Build the deployed bundle:

   ```bash
   yarn build:kit
   ```

   The bundle is one script, `dist/deploy/wind/index.js`. `DTAAS_KIT_OUT`
   names another output folder. It takes React, the router, MUI, zod and the
   contract from the client (`SHARED_MODULES`) and bundles everything else
   the kit imports.

1. Deploy it: copy the script to `extensions/wind/index.js` next to the
   client's `env.js` and list it in `REACT_APP_EXTENSIONS_DEPLOYED`, for
   example `'extensions/wind/index.js'`. The client loads it when it starts,
   without a rebuild.

The soil-kit, next to this folder in `kits/soil-kit`, is a kit made this
way, with its own unit and integration tests.

## Develop Inside This Repository

The kit is a package of its own, as every kit of `kits/` is. `yarn sdk` builds
the SDK at the root of this repository, packs it and unpacks the tarball into
`node_modules`, so the kit is tested against the SDK it sits next to. A copy
outside this repository deletes the `sdk` script and installs the SDK from
npm with `yarn add --dev @into-cps-association/dtaas-extensions`.

```bash
yarn install --frozen-lockfile --ignore-scripts   # once, at the repository root
cd kits/hello-kit
yarn install --frozen-lockfile --ignore-scripts
yarn sdk
yarn format:check && yarn lint && yarn typecheck
yarn test:coverage
```

`tests/kitBundle.test.ts` builds the bundle, runs it with the client's shared
modules and checks that it registers its extension and passes the conformance
harness.
