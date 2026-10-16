import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/tests/fixtures/**',
      '**/parser/generated/**',
      'docs/.vitepress/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Plan 0413: a worker module eess-mermaid runs untransformed, so it is plain JavaScript. No
  // tsconfig includes it, so it is linted without the type-checked rules.
  {
    files: ['packages/*/src/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettierConfig,
)
