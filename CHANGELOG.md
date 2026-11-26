# Changelog

All notable changes to this package are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Version 0.2.0, the first under the name `@into-cps-association/dtaas-extensions`.

### Added

- `kits/soil-kit`, a kit made from the `hello-kit` template: the `soil-profile` substrate, the `soil-depth` anchor kind, the soil presets, a page and the `soil_sensor` table it adds to the services.
- `./testing` gives `runDeployedBundle`, which runs the code of a deployed bundle with the modules the host shares and returns what it registered, so a kit's bundle test needs no runner of its own.
- `scripts/install-contract.mjs`, the one script behind `yarn contract` in every kit.
- `tests/fixtures/kit`, the smallest kit, which `kitBundle.test.ts` builds with `kitBuildConfig` and mounts, so the `./deploy` entry is tested without any of the kits.
- `@mui/icons-material` as a development dependency, for the icon of the fixture kit's page.
- `react-dom/client` among the shared modules, under `reactDomClient`, so a kit that draws the controls of a substrate starts its React root with the host's copy. A host fills the key from its own `react-dom/client`.
- `./core` and `./react` entries. `./core` holds the constants, the validation, the API range helpers and the types, and imports no React at run time, so a host or tool that runs without React can import it. `./react` holds `HostProvider` and `useHost`. The root entry re-exports both, so every import of 0.1 keeps working. The package smoke test fails if any module `./core` loads imports React.
- `API_VERSION`, the version of the extension API, which is the version of the package, and `API_MAJOR`, derived from it. A unit test checks that `API_VERSION` matches `package.json`.
- `readVisualisationAsset(input, { allowedOrigins })` in `./schema`, the way a host reads a `visualisation.json`. It refuses more than 1 MiB (`MAX_ASSET_BYTES`) before parsing, parses the JSON, checks the schema and refuses a transport whose origin the deployment does not allow. `parseVisualisationAsset` takes the same policy as an optional second argument.
- `checkConformance` calls every converter, field kernel and substrate loader and refuses one that does not return a promise, so `() => new HeavyAdapter()` no longer passes as lazy.
- `validateExtension` checks route paths: a path is relative to the extension's mount point and has no `.` or `..` segment, backslash, control character or percent-encoded `.`, `/` or `\`.
- API version `1.5.0` of the earlier numbering: the optional `unit` of `SignalSample` and `Sampled`, the unit a source gave with a value. A kit compares it with the unit it expects and no longer has to assume one from the name of the quantity. A host that does not know the unit leaves the field out.

### Changed

- The package is renamed from `@into-cps-association/dtaas-sdk` to `@into-cps-association/dtaas-extensions`. The keys under `DTAAS_SHARED` follow the name: `dtaasExtensions`, `dtaasExtensionsCore`, `dtaasExtensionsReact` and `dtaasExtensionsSchema`.
- The API is numbered with the package, at `0.2.0`, and `sdk` is `0`. The numbers `1.1.0` to `1.5.0` in the entries below and in 0.1.1 were never published as a package version. An extension built for 0.1 changes `sdk: 1` to `sdk: 0` and its `apiRange` to `^0.2`. `SDK_VERSION` and `SDK_MAJOR` remain as aliases of `API_VERSION` and `API_MAJOR`.
- `apiRange` is read by npm's `semver` package (7.8.6, a new dependency), so a range in a manifest and the same range in `peerDependencies` get the same answer. `~1` now includes `1.5.0`, `<=1.0` includes `1.0.5`, `1.1` means every `1.1.x` and `^0.0.3` no longer includes `0.0.5`. An empty range and a range longer than 256 characters are refused.
- The `./eslint` rules for dynamic imports are built from the same list as the static ones. Their documentation says what they are: guards against the usual mistakes and not a security boundary.
- Internal names that read as something else are renamed: `describe` is `printable` and no longer prints an object through its own `toString`, and `Loose` is `UntypedExtension`. `LibraryService.resolve` documents `workspace://` for workspace files, since `ws://` names a WebSocket elsewhere in the contract.
- The fakes of `./testing` return promises without `async` functions that await nothing, `replayFixture` computes each frame time from its index and `createMemoryContents` strips slashes without a regular expression that backtracks.
- `examples/` is now `kits/`. Every kit is a package of its own, with its lockfile, lint and format settings, tests and a job in the CI matrix, and takes the contract from `yarn contract`. The root tooling no longer reads the kits, and the root `yarn build:kit` is gone: each kit builds its bundle with its own `yarn build:kit`. The `hello-kit` tests that ran at the root moved into the kit.
- `kits/bim-kit` is the source of bim-kit 0.2.0 with the changes of its next release, in place of the port of bim-kit 0.1.1. It contributes the `aec` substrate, builds a deployed bundle with `kitBuildConfig` and keeps its own lockfile and CI job. Its tests run with the Node test runner against the built package and with Jest for the substrate and the bundle.

### Fixed

- `colourAt` keeps a position off the scale at the nearer end of the scheme and gives the first colour for `NaN`, as `position` does for a domain with no width. It threw for a negative position and returned an invalid colour above 1.

### Security

- `./schema` bounds the `substrates` record to 1000 entries and a substrate's `options` to 64 settings, each a scalar, a list of scalars or one level of named scalars. Before, `options` took any value and `substrates` any number of entries.
- `./schema` refuses a `..` segment, plain or percent-encoded, in a relative path, a `lib:` URL or a `git:` URL, which the host resolves inside the twin or its library.
- `./schema` refuses an `http` transport that polls more often than once a second.
- A host passes the origins its deployment allows to `readVisualisationAsset`, so an asset cannot point its viewers at a broker or an endpoint the deployment did not choose (E4, K4).

### Deprecated

- The npm package `@into-cps-association/dtaas-sdk`. Once 0.2.0 is published under the new name, the maintainer marks the old one with `npm deprecate @into-cps-association/dtaas-sdk "Renamed to @into-cps-association/dtaas-extensions. Install that package instead."`.

## [0.1.1] - 2026-11-09

### Added in 0.1.1

- `./schema` checks that every encoding reads a signal some transport provides.
  An encoding reads its `target` on `measured` or on the `channel` it names and
  a `residual` also reads it on its `against` channel. An `mqtt` transport
  provides the paths its topics match, with MQTT wildcards. The other
  adapters provide any path on their channel, which is `measured` when none is
  named. A binding that reads a signal no transport provides is refused with an
  issue that names the binding, the signal and the channel.
- `DtaasExtension.apiRange`: the range of the extension API an extension works
  with, such as `^1.1`. `validateExtension` refuses an extension whose range
  does not include the host's API version, so a host refuses it at start-up
  instead of failing later (requirement K1). An extension without a range is
  checked by its `sdk` major only, as before.
- `SDK_VERSION`, the version of the extension API this package describes,
  with `satisfiesApiRange` and `isApiRange`. It starts at `1.1.0` with this
  entry and the entries below raise it to `1.4.0`, its value in this release.
  A new contribution point or service raises the minor number and a change an
  existing extension would notice raises the major number (requirement K10).
- `ValidateOptions.hostApiVersion`, for a host that implements another version
  than the package it was built with.
- Services between extensions (requirement K12), API version `1.2.0`: an
  extension offers services in `provides`, each named `<id>.<name>` and built
  once by `create(host)`. It names the services it uses in `requires` and
  reaches them through `HostServices.extensions.get(id)` and never imports the
  code of another extension. `validateExtension` checks the names and
  `fakeHostServices` takes a `services` option.
- API version `1.3.0`: the colour schemes of the encodings (`SCHEMES`,
  `colourAt` and `position`), so a kit draws a legend in the colours of the
  core. The same version adds the optional `UiService.Theme`, the host's theme
  for what a kit draws into a React root of its own.
- API version `1.4.0`: deployed extensions (requirement K9). A deployment lists
  bundles under `extensions/<id>/` in `REACT_APP_EXTENSIONS_DEPLOYED` and the
  host loads them at start, without a rebuild. The `./deploy` entry gives
  `kitBuildConfig`, the Vite settings that build such a bundle with React, the
  router, MUI, zod and this contract taken from the host (`SHARED_MODULES`)
  instead of bundled. Its `muiIconsPlugin` lets a kit import any icon of
  `@mui/icons-material` and bundle only that icon.
- `./deploy` is published as compiled JavaScript, so the Vite configuration of a
  kit outside this repository imports `kitBuildConfig` like any other package.
- `examples/hello-kit` is the template for a new kit: relative imports, a
  `package.json` with build and type-check scripts and a `vite.config.ts` that
  builds the deployed bundle with `./deploy`. `yarn build:kit <kit folder>`
  builds an example kit inside this repository and
  `tests/integration/kitBundle.test.ts` mounts the bundle on a fake host.

### Changed in 0.1.1

- `./schema` makes the `url` of an `mqtt` transport optional. A host with a
  signals gateway serves the topics itself, so a `visualisation.json` can name
  the topics it reads and leave the broker to the host. A declaration that gives
  a URL is still valid and the URL scheme is still checked. The `url` of a
  `stomp` transport stays required.
- `aec` is no longer a standard substrate (requirement K5). The bim extension
  contributes it, so a preset that names `aec` needs an extension that
  contributes the substrate.

### Security in 0.1.1

- `./schema` refuses a transport `url` or a substrate `source` that carries a
  user name or password, such as `mqtt://user:secret@broker`, so a
  `visualisation.json` committed to a repository can never hold a broker or
  database credential.
- `./schema` refuses a transport `url` or a substrate `source` whose scheme is
  not allowed, so `javascript:`, `data:`, `vbscript:` and `file:` URLs no longer
  pass `parseVisualisationAsset`. MQTT and STOMP transports take `ws`, `wss`,
  `mqtt` and `mqtts`. ThingsBoard takes `http`, `https`, `ws` and `wss`.
  InfluxDB and HTTP take `http` and `https`. A file transport takes `http`,
  `https`, `lib` or a relative path. A substrate source takes `lib`, `git`,
  `http`, `https`, `blob` or a relative path. Schemes are read with the
  browser's URL parser, so case and embedded tabs do not hide a scheme. A
  relative path that names another host is refused.
- `./schema` limits every string field of a `visualisation.json` to 2048
  characters and every list to 1000 items. This release did not bound the
  `substrates` record, a substrate's `options` or the size of the file, so the
  claim that an oversized asset is refused held for strings and lists only.
  0.2.0 bounds the rest.

## [0.1.0] - 2026-09-27

### Added in 0.1.0

- Extension contract, revision 1: `DtaasExtension`, `DomainContribution` and
  every contribution type of the architecture proposal (§6.1).
- Host contract: `HostServices` with `auth`, `library`, `contents`, `git`,
  `signals`, `viz`, `ui`, `logger`, `settings` and `config` (§6.2);
  `HostProvider` and `useHost()`.
- Visualisation layer types: `SignalSample`, `Channel`, `TransportAdapter`,
  `Anchor`, `AnchorKind`, the encoding vocabulary, `SubstrateAdapter`.
- `defineExtension`, `isLazyComponent`, `isLazyLoader` and
  `validateExtension` (identity, laziness, uniqueness, navigation and
  substrate rules).
- Env helpers `readExtensionConfig`, `isExtensionDisabled` and `envPrefix`.
- `./schema`: zod schemas for `visualisation.json` with cross-reference
  checks, encodings, anchors, transports, substrates and presets.
- `./testing`: `fakeHostServices`, `renderWithHost`, `replayFixture`,
  `checkConformance` and a socket guard.
- `SignalsService.connection` (`ConnectionState`, `ConnectionStatus`) and
  `worstConnectionState`, so a kit can tell a quiet signal from a dead
  connection; fake `signals.setConnection(state, paths?)` for tests.
- `./eslint`: flat-config rules enforcing the extension boundary (§6.3).
- `examples/hello-kit`: the template layout of a domain kit.

### Security in 0.1.0

- `validateExtension` rejects a navigation path whose path part has a `.` or
  `..` segment, a backslash, a control character, or a percent-encoded `.`,
  `/` or `\`, so a path cannot leave the extension's mount point once a
  browser resolves it. A path that needs an encoded slash inside a segment
  is rejected as well.
