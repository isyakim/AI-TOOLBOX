import { defineConfig } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import pluginPrettier from '@vue/eslint-config-prettier'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}']
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/out/**', '**/node_modules/**']
  },
  ...pluginVue.configs['flat/recommended'],
  ...vueTsEslintConfig(),
  pluginPrettier,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'prettier/prettier': 'off',
      'vue/no-v-html': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  }
])
