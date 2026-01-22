import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignore generated/third-party artifacts.
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.npm-cache/**'],
  },

  js.configs.recommended,

  // Node globals (process, Buffer, etc.).
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript (this repo is ESM, Node16 module resolution).
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        // We keep this lightweight (no type-aware linting) to avoid
        // requiring tsconfig resolution during lint in all environments.
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      // Prefer TS-aware unused-vars.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Keep the codebase healthy by pushing toward real types over time.
      '@typescript-eslint/no-explicit-any': 'error',

      // Some Slack payloads are large and partially known. `unknown` is fine.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Tests often need mocking escape hatches; keep them readable.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Keep ESLint from fighting Prettier.
  prettier,
];
