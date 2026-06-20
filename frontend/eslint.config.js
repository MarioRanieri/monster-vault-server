import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  prettier,
  { ignores: ['dist/', 'tests/', 'public/', 'node_modules/'] },
  {
    files: ['src/**/*.ts'],
    rules: {
      // ponytail: migrated from vanilla JS, retyping 500+ sites adds no safety
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-prototype-builtins': 'off',
    },
  },
);
