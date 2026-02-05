import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/unit/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
