# 🧩 DTaaS Extensions

`@into-cps-association/dtaas-extensions` is the contract between the
[DTaaS](https://github.com/INTO-CPS-Association/DTaaS) web client (the
**host**), the common visualisation core (`dtaas-visualisation`) and **domain
extensions** (`bim-kit`, `wind-kit`, `pump-kit`, …).

A domain extension is an ordinary npm package. It declares what it
contributes (pages, navigation, digital twin tabs, asset previews, anchor
kinds, converters, encoding presets, substrates) as one `DtaasExtension`
object, and receives everything it needs from the host through an injected
`HostServices` object. It never imports DTaaS internals and never opens its
own sockets.

The design is described in
[`docs/dtaas-client-modular-architecture.md`](docs/dtaas-client-modular-architecture.md).

## 📦 Install

```bash
yarn add @into-cps-association/dtaas-extensions
```

Peer dependencies: `react >=19` and `zod ^4`. The `./testing` subpath also
needs `@testing-library/react` and `react-router-dom`; the `./eslint` subpath
needs `eslint >=9`.

The package is ESM only.

## 🚪 Entry points

| Import                                           | What it gives you                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `@into-cps-association/dtaas-extensions`         | Everything in `./core` and `./react`, so every import of 0.1 keeps working                                                          |
| `@into-cps-association/dtaas-extensions/core`    | Contract types, `defineExtension`, `validateExtension`, `satisfiesApiRange`, env config helpers and constants, with no React import |
| `@into-cps-association/dtaas-extensions/react`   | `HostProvider` and `useHost`                                                                                                        |
| `@into-cps-association/dtaas-extensions/schema`  | zod schemas for `visualisation.json`, encodings, anchors, transports, substrates and presets, and `readVisualisationAsset`          |
| `@into-cps-association/dtaas-extensions/testing` | `fakeHostServices`, `renderWithHost`, `replayFixture`, `checkConformance`                                                           |
| `@into-cps-association/dtaas-extensions/eslint`  | Flat-config rules that catch an extension reaching outside its boundary by mistake                                                  |
| `@into-cps-association/dtaas-extensions/deploy`  | `kitBuildConfig`, the Vite build settings of a deployed kit, for the kit's `vite.config.ts`                                         |

The host bundles only the root entry. A host or tool that runs without React, such as a command line tool, imports `./core`. The types of the React-facing members of `HostServices` (`AuthService.useUser`, `LibraryService.useBaseUrl`, `UiService.Page`, `Playhead.use` and `ConnectionStatus.use`) still name React types, so a type check of them needs `@types/react`.

The `./eslint` rules catch the usual mistakes, such as importing a broker client or opening a WebSocket. They are not a security boundary: extensions are trusted code, and `fetch`, `XMLHttpRequest`, computed access such as `globalThis['WebSocket']` and code that runs after mount pass them.

## 🚀 A minimal extension

```tsx
// src/dtaas/index.ts
import { lazy } from 'react';
import { defineExtension } from '@into-cps-association/dtaas-extensions';

export const extension = defineExtension({
  id: 'wind',
  name: 'Wind Farms',
  version: '0.1.0',
  sdk: 0,
  routes: [{ path: '', element: lazy(() => import('./pages/WindPage')) }],
  navigation: [{ label: 'Wind Farms', path: '/wind' }],
});
```

```tsx
// src/dtaas/pages/WindPage.tsx
import { useHost } from '@into-cps-association/dtaas-extensions';

export default function WindPage() {
  const host = useHost();
  const t = host.signals.playhead.use();
  const power = host.signals.valueAt('farm1/wt1/power', 'measured', t);
  return (
    <host.ui.Page title="Wind Farms">
      <p>Turbine 1: {String(power?.value ?? 'no reading')}</p>
    </host.ui.Page>
  );
}
```

```ts
// tests/unit/extension.test.ts
import { checkConformance } from '@into-cps-association/dtaas-extensions/testing';
import { extension } from '../../src/dtaas';

it('satisfies the DTaaS extension contract', async () => {
  expect(await checkConformance(extension)).toEqual({
    passed: true,
    errors: [],
  });
});
```

[`examples/hello-kit`](examples/hello-kit) is a complete, tested example.

[`examples/soil-kit`](examples/soil-kit/README.md) is a kit made from that template: soil profiles drawn as a substrate of their own, with a page, an anchor kind, presets and the tables it adds to the services. The tooling at the root checks and tests it as it does `hello-kit`.

[`examples/bim`](examples/bim/README.md) is a larger, standalone example: the source of bim-kit with the `aec` substrate that draws a building, with its own package, lockfile, test suites and CI job.

## 🔢 Versions

`API_VERSION` is the version of the extension API and the version of this package, `0.2.0`. `API_MAJOR` is derived from it. Every extension declares `sdk: 0`, the major it was built against, and may declare `apiRange`, a semver range such as `^0.2`. The host refuses an extension whose range does not include its `API_VERSION`. The range is read by npm's own `semver` package, so the same range in a kit's `peerDependencies` gets the same answer from the package manager. While the API is at `0.x`, a change an existing extension would notice raises the minor number.

`SDK_VERSION` and `SDK_MAJOR` remain as aliases of `API_VERSION` and `API_MAJOR` and will be removed in a later minor release.

## Former Name

This package was published as `@into-cps-association/dtaas-sdk` up to version 0.1.0. That name is deprecated. Replace the dependency and the imports:

```bash
yarn remove @into-cps-association/dtaas-sdk
yarn add @into-cps-association/dtaas-extensions
```

The maintainer marks the old name as deprecated on npm once 0.2.0 is published under the new name:

```bash
npm deprecate @into-cps-association/dtaas-sdk "Renamed to @into-cps-association/dtaas-extensions. Install that package instead."
```

## 📚 Documentation

- [Writing an extension](docs/extension-authoring.md)
- [Integrating the contract into a host](docs/host-integration.md)
- [The `visualisation.json` schema](docs/visualisation-schema.md)
- [Testing an extension](docs/testing.md)
- [Developing this package](DEVELOPER.md)
- [Changelog](CHANGELOG.md)

## ⚖️ License

This package is distributed under the INTO-CPS Association Public License.
See [LICENSE.md](LICENSE.md).
