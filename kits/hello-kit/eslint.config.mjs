// Lint rules for the kit, the same set as bim-kit's: the recommended
// JavaScript and TypeScript rules, the classic React hooks rules, the rules
// the SDK asks of every kit, and Prettier's own config last so that no style
// rule fights the formatter.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
// Resolves after `yarn sdk` unpacks the built SDK into node_modules.
import dtaasKitConfig from '@into-cps-association/dtaas-sdk/eslint';

export default [
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  js.configs.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  {
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'error',
      'no-await-in-loop': 'error',
      'no-new-func': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Command-line scripts report to the terminal.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  {
    // AGENTS.md: functions stay under 25 lines and files under 250 lines.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines-per-function': ['error', { max: 25 }],
      'max-lines': ['error', { max: 250 }],
    },
  },
  // The kit obeys the import boundaries the SDK asks of every kit.
  ...dtaasKitConfig.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}'],
  })),
  prettier,
];
