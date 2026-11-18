/**
 * @jest-environment node
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Linter } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import dtaasKitConfig from 'src/eslint';

// The example kits are templates for new kits, so their sources must stay
// inside the boundary that the kit ESLint config draws.
const examples = path.join(__dirname, '../../examples');

// The bim kit writes its web-ifc WebAssembly into src/generated/ when it
// builds, which is no source of the kit.
function sourcesOf(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !file.startsWith(`generated${path.sep}`))
    .map((file) => path.join(folder, file));
}

const kitSources = ['hello-kit', 'soil-kit', 'bim'].flatMap((kit) =>
  sourcesOf(path.join(examples, kit, 'src')),
);

const lint = (file: string) =>
  new Linter({ configType: 'flat' })
    .verify(
      readFileSync(file, 'utf8'),
      [
        {
          files: ['**/*.ts', '**/*.tsx'],
          // Only the boundary rules run here, so a directive that silences a
          // rule of the kit's own lint config is not unused.
          linterOptions: { reportUnusedDisableDirectives: 'off' },
          languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaFeatures: { jsx: true } },
            sourceType: 'module',
          },
        },
        ...dtaasKitConfig,
      ],
      path.relative(examples, file),
    )
    .map((m) => `${m.ruleId}: ${m.message}`);

describe('the example kits', () => {
  it('have sources to check', () => {
    expect(kitSources.length).toBeGreaterThan(5);
  });

  it.each(kitSources.map((file) => [path.relative(examples, file), file]))(
    'keep %s inside the kit boundary',
    (_name, file) => {
      expect(lint(file)).toEqual([]);
    },
  );
});
