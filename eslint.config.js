// Type-aware rules for TypeScript, React, hooks, and accessibility, plus folder boundaries
// that keep the domain logic free of UI and storage code. Formatting is left to Prettier.
import js from '@eslint/js'
import eslintReact from '@eslint-react/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'playwright-report/', 'test-results/']),

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      eslintReact.configs['strict-type-checked'],
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.configs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Raised from a warning: user text must always render as text, never as HTML
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
      // A labelled region that scrolls sideways needs a tab stop so keyboards can scroll it too
      'jsx-a11y-x/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
    },
  },

  {
    // Config files at the project root, the build helpers they use, and the end-to-end tests run
    // in Node
    files: ['*.{js,ts}', 'build/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    // Plain scripts copied as they are into the build, such as theme-init.js, run in the browser
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },

  {
    // The domain logic stays pure so it can be tested on its own and reused by any UI or store
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(react|react-dom|dexie)(/|$)|^@/(data|ui)(/|$)|^(\\.\\./)+(data|ui)(/|$)',
              message: 'src/core must stay pure: no React, Dexie, src/data, or src/ui imports.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
      ],
    },
  },

  {
    // Storage sits behind the repositories, so a different store could replace Dexie later
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^dexie(/|$)',
              message: 'The UI reaches storage through the repositories in src/data, not Dexie.',
            },
          ],
        },
      ],
    },
  },

  prettier,
])
