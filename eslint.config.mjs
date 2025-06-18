import { defineConfig, globalIgnores } from 'eslint/config'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import prettier from 'eslint-plugin-prettier'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default defineConfig([
  globalIgnores(['**/node_modules', '**/dist']),
  {
    extends: compat.extends(
      'plugin:@typescript-eslint/recommended',
      'prettier',
      'plugin:prettier/recommended',
    ),

    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
      'unused-imports': unusedImports,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...Object.fromEntries(
          Object.entries(globals.jquery).map(([key]) => [key, 'off']),
        ),
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module',
    },

    rules: {
      'unused-imports/no-unused-imports': 'error',
      'no-unused-vars': 'off',
      'no-promise-executor-return': 'off',
      'no-continue': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',

      'prettier/prettier': [
        'warn',
        {
          semi: false,
          trailingComma: 'all',
          singleQuote: true,
          printWidth: 80,
          tabWidth: 2,
        },
      ],

      '@typescript-eslint/explicit-function-return-type': 'off',

      '@typescript-eslint/no-unused-vars': [
        0,
        {
          ignoreRestSiblings: true,
        },
      ],

      'import/no-unresolved': 'off',
      'import/extensions': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/prefer-default-export': 'off',
      'no-underscore-dangle': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-bitwise': 'off',
      'no-nested-ternary': 'off',
      'consistent-return': 'off',
      'class-methods-use-this': 'off',
      'no-return-assign': 'off',
      'array-callback-return': 'off',
      radix: 'off',
      camelcase: 'off',
      'no-await-in-loop': 'off',
    },
  },
  {
    files: ['**/*.json'],

    rules: {
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
])
