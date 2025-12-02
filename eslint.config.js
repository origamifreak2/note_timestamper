// Flat ESLint config for Note Timestamper
// See: https://eslint.org/docs/latest/use/configure/flat-config
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignore patterns (replacement for .eslintignore)
  {
    ignores: ['vendor/**', 'static/**', 'build/**', 'dist/**', 'node_modules/**'],
  },
  // Main JS sources
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      jsdoc: {
        tagNamePreference: {
          fileoverview: 'file',
        },
      },
    },
    plugins: { jsdoc },
    rules: {
      // Base recommended + prettier (ordering matters to let prettier win formatting)
      ...jsdoc.configs.recommended.rules,
      ...prettier.rules,

      // Keep high-value documentation signals on public API only; relax internals.
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
            // MethodDefinition omitted to avoid spam on internal class methods
          },
        },
      ],

      // Suppress granular requirements to cut noise until full doc pass is desired.
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-check': 'off',
      'jsdoc/require-description': 'off',
      'jsdoc/check-types': 'off',
      'jsdoc/no-defaults': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/check-alignment': 'off',
    },
  },
];
