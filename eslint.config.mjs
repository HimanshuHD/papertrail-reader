import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'coverage/**',
    'node_modules/**',
    '_site/**',
    'incoming/**',
    'candidate/**',
    '_upload/**',
    'playwright-report/**',
    'test-results/**',
    'visual-evidence/**',
    'visual-results/**',
    'visual-report/**',
  ]),
  {
    files: ['**/*.{js,mjs,ts,vue}'],
    extends: [
      js.configs.recommended,
      ...ts.configs.recommended,
      ...vue.configs['flat/recommended'],
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __READER_DIAGNOSTICS__: 'readonly',
        __DIAGNOSTIC_SOURCE__: 'readonly',
      },
      parserOptions: { parser: ts.parser },
    },
  },
  prettier,
])
