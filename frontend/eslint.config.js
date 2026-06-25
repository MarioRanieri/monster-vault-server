// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'tests/', 'public/', 'node_modules/'] },
  // Segnala i commenti `// eslint-disable-*` ormai inutili (igiene a costo zero).
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  eslint.configs.recommended,
  // Type-aware: usa le info di tipo → sblocca no-floating-promises, no-misused-promises, ecc.
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // L'app espone i moduli su `window` e usa `(window as any).fn()` per gli
      // onclick inline: il valore `any` si propaga ovunque, quindi la famiglia
      // no-unsafe-* è solo rumore. Le teniamo spente (coerente con no-explicit-any).
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Disagrees with the build's tsc on DOM casts (querySelector → Element|null)
      // and `as any`; its --fix would strip assertions tsc needs. Not reliable here.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-prototype-builtins': 'off',
    },
  },
  // Il file di config (.js) non è nel tsconfig: niente regole type-checked su di lui.
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
];
