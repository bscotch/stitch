// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Single ESLint (flat) config for the whole monorepo.
 * Run from the repo root: `pnpm lint`
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/tmp/',
      '**/sandbox/',
      '**/.svelte-kit/',
      '**/.turbo/',
      '**/*.timestamp-*',
      '**/samples/',
      '**/samples-out/',
      // Generated code
      '**/*.auto.ts',
      // Untracked leftovers from old packages
      'packages/core/',
      'packages/spritely/',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'prefer-const': 'off',
      'no-useless-catch': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['private-constructors', 'protected-constructors'] },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-misused-new': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'warn',
      eqeqeq: 'off',
      'getter-return': 'off',
      'no-constant-condition': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-redeclare': 'off',
      'no-restricted-imports': ['error', { paths: ['console'] }],
      'no-unused-vars': 'off',
      'require-await': 'warn',
      'no-control-regex': 'warn',
      'no-misleading-character-class': 'warn',
      'no-case-declarations': 'off',
    },
  },
  {
    // TypeScript already checks for undefined identifiers (and knows about
    // ambient types like `NodeJS` and Svelte's `$$Generic`)
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.svelte'],
    rules: { 'no-undef': 'off' },
  },
  {
    // Svelte components (site + VSCode webviews)
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      // Can't see reads from the component's template, so it
      // flags state initializers that are later reassigned.
      'no-useless-assignment': 'off',
    },
  },
  {
    // Type-aware rules for TypeScript source
    files: [
      'packages/*/src/**/*.ts',
      'packages/*/src/**/*.mts',
      'scripts/**/*.mts',
    ],
    ignores: ['packages/site/**'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          // node:test tracks these itself, so they don't need to be awaited
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test', 'suite', 'skip', 'todo', 'only'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.mts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    // Plain CommonJS scripts
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  ...svelte.configs.prettier,
  prettier,
);
