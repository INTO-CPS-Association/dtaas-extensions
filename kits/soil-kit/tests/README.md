# Tests

Jest runs everything here, with `yarn test:coverage` at the root of this
repository or with `yarn test` in a copy of the folder.

| Folder         | What It Holds                                                             |
| :------------- | :------------------------------------------------------------------------ |
| `unit/`        | Tests of `src/core/`, with no host                                        |
| `integration/` | The extension on the SDK's fake host, the substrate and the example files |

`jest.setup.ts` and `setupTests.ts` prepare the jsdom environment the page and
substrate tests need.
