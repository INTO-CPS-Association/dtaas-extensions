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
| `yarn typecheck`                    | Type-check sources, tests and examples                             |
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
  integration/        hello-kit conformance, fixture replay, asset round trips, ESLint rules
  e2e/                packed-tarball smoke test
  fixtures/           junction-7 visualisation.json, recorded stream, extension fixtures
examples/hello-kit/   the template layout of a domain kit
examples/soil-kit/    a kit made from the template, checked and tested by the root
examples/bim/         bim-kit, a standalone package with its own lockfile and CI job
```

## Conventions

- Functions under 25 lines and files under 250 lines (DTaaS `AGENTS.md`).
- Interfaces over type aliases; a type alias only where required
  (unions, `z.infer`, structural compatibility).
- `*.types.ts` for type-only modules, `*.schema.ts` for zod schemas;
  PascalCase for components, camelCase otherwise.
- A module with one export uses a default export (airbnb-base).
- Imports inside `src/` are relative, so the sources can be copied into a
  host as they are. Tests use the `src/*`, `tests/*` and `examples/*`
  aliases.
- Types that have a schema are inferred from it with `z.infer`, so the two
  cannot drift. The root entry imports schema modules with `import type` only,
  so `zod` is not a runtime import of the host bundle.
- `globalThis` instead of `window`; `node:` prefixes for Node built-ins.
- Tests live in `tests/`, never next to the source, and match `*.test.ts(x)`.

## Example Kits

`examples/hello-kit` and `examples/soil-kit` are checked by the commands
above: `yarn lint`, `yarn typecheck` and `yarn format:check` cover their files,
`yarn test:coverage` runs their tests with the SDK's source, and
`tests/integration/kitBundle.test.ts` builds each one with
`yarn build:kit <kit folder>` and mounts the bundle on a fake host.

`examples/bim` is a standalone package (its own `package.json`, `yarn.lock`,
tests and CI job), not part of this workspace, because it brings three.js,
web-ifc and a test suite of its own. From the repository root:

```bash
yarn install                # once, at the root
cd examples/bim
yarn install --frozen-lockfile --ignore-scripts
yarn sdk                    # builds, packs and installs this SDK as a tarball
yarn typecheck
yarn test                   # the Node test runner suite, then the Jest suite
```

## Releasing

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Merge to `main`. The `DTaaS SDK npm package` workflow validates the package
   and, in the `INTO-CPS-Association` organisation only, publishes it to
   GitHub Packages and npmjs. A prerelease version (`x.y.z-alpha.n`) is
   published under the `next` tag.
