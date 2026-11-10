import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    __READER_DIAGNOSTICS__: true,
    __DIAGNOSTIC_SOURCE__: { sha: 'test-source', dirty: true },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
