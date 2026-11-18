/**
 * Empty dist/ before a build.
 *
 * tsc writes what the sources produce and never deletes. A module removed
 * from src/ kept its old output in dist/, and the package would have been
 * published with it.
 */

import { rmSync } from 'node:fs';

// From this file and not from the current directory, so running the script
// from the repository root never removes the root's dist/.
rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
