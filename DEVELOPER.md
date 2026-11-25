# 🛠️ Developer Guide

This package follows the coding standards of the DTaaS client and of
`lib/dt-automation` in the
[DTaaS repository](https://github.com/INTO-CPS-Association/DTaaS).

## Requirements

- Node.js 24 (or newer)
- Yarn 1.22.22
- Optional: [qlty](https://qlty.sh) for `yarn prep`

## Commands

| Command                             | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `yarn install`                      | Install dependencies                                               |
| `yarn syntax`                       | Lint and fix with ESLint                                           |
| `yarn lint`                         | Lint without fixing (used in CI)                                   |
| `yarn format` / `yarn format:check` | Format with Prettier / check formatting                            |
| `yarn typecheck`                    | Type-check sources and tests                                       |
| `yarn test:unit`                    | Unit tests (`tests/unit`)                                          |
| `yarn test:int`                     | Integration tests (`tests/integration`)                            |
| `yarn test:coverage`                | Unit and integration tests with the coverage gate                  |
| `yarn test:e2e`                     | Build, pack, install into a clean project and import every subpath |
| `yarn test:all`                     | `test:coverage` then `test:e2e`                                    |
| `yarn check:package`                | Check `package.json`, the exports map and the packed types         |
| `yarn build`                        | Build `dist/` (tsup ESM + `tsc` declarations + `tsc-alias`)        |
| `yarn prep`                         | Everything above plus `qlty`, before opening a pull request        |
| `yarn clean`                        | Remove `dist/` and `coverage/`                                     |

## Layout

```text
src/
  index.ts            root entry (bundled by the host)
  extension/          DtaasExtension types, constants, helpers, validation rules
  host/               HostServices types and HostProvider/useHost
  visualisation/      layer types: signals, anchors, encodings, substrates, contributions
  schema/             ./schema entry: zod schemas
  testing/            ./testing entry: fakes, renderWithHost, replayFixture, checkConformance
  eslint/             ./eslint entry: kit boundary rules
  deploy/             ./deploy entry: Vite settings for a deployed kit bundle
tests/
  unit/               mirrors src/
  integration/        deployed bundle, fixture replay, asset round trips, ESLint rules
  e2e/                packed-tarball smoke test
  fixtures/           junction-7 visualisation.json, recorded stream, the fixture kit
kits/hello-kit/       the template layout of a domain kit
kits/soil-kit/        a kit made from the template
kits/bim-kit/         bim-kit
```

## Conventions

- Functions under 25 lines and files under 250 lines (DTaaS `AGENTS.md`).
- Interfaces over type aliases; a type alias only where required
  (unions, `z.infer`, structural compatibility).
- `*.types.ts` for type-only modules, `*.schema.ts` for zod schemas;
  PascalCase for components, camelCase otherwise.
- A module with one export uses a default export (airbnb-base).
- Imports inside `src/` are relative, so the sources can be copied into a
  host as they are. Tests use the `src/*` and `tests/*` aliases.
- Types that have a schema are inferred from it with `z.infer`, so the two
  cannot drift. The root entry imports schema modules with `import type` only,
  so `zod` is not a runtime import of the host bundle.
- `globalThis` instead of `window`; `node:` prefixes for Node built-ins.
- Tests live in `tests/`, never next to the source, and match `*.test.ts(x)`.

## Kits

Every folder of `kits/` is a package of its own, with its `package.json`,
`yarn.lock`, lint and format settings, tests and a job in the CI matrix. The
root tooling does not read them. A kit takes the SDK from `yarn sdk`, which
builds the SDK at the repository root, packs it and unpacks the tarball into
the kit's `node_modules`, so each kit is tested against this commit of the SDK,
installed the way any consumer installs it. From the repository root:

```bash
yarn install                # once, at the root
cd kits/soil-kit            # or kits/hello-kit, kits/bim-kit
yarn install --frozen-lockfile --ignore-scripts
yarn sdk                    # again after every change to the SDK
yarn format:check
yarn lint
yarn typecheck
yarn test:coverage          # also builds the deployed bundle and mounts it
yarn build:kit              # the deployed bundle, dist/deploy/<id>/index.js
```

The SDK's own tests build a fixture kit, `tests/fixtures/kit/`, with
`kitBuildConfig`, so the `./deploy` entry is tested without depending on any
kit.

## Releasing

1. Bump `version` in `package.json` and `API_VERSION` in `src/extension/constants.ts` to the same value (a unit test checks that they match), and add a `CHANGELOG.md` entry.
2. Merge to `main`. The `DTaaS SDK npm package` workflow validates the package
   and, in the `INTO-CPS-Association` organisation only, publishes it to
   GitHub Packages and npmjs. A prerelease version (`x.y.z-alpha.n`) is
   published under the `next` tag.
