import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/generated/**', '**/next-env.d.ts', '**/dist/**'] },
  { ...eslint.configs.recommended, files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'] },
  ...tseslint.configs.recommended,
  { files: ['scripts/load-api.js'], languageOptions: {
    sourceType: 'module', globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly', open: 'readonly' },
  } },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: {
    AbortSignal: 'readonly', document: 'readonly', requestAnimationFrame: 'readonly', window: 'readonly', navigator: 'readonly', innerWidth: 'readonly', sessionStorage: 'readonly',
  } } },
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', fetch: 'readonly', URL: 'readonly', performance: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } } },
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
