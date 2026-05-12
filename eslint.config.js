import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import configPrettier from 'eslint-config-prettier';

const typescriptRules = {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-empty-interface': 'warn',
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
};

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...typescriptRules,
      'no-unused-vars': 'off',
      'no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  configPrettier,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.min.js'],
  },
];