import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  define: {
    __READER_DIAGNOSTICS__: command === 'serve' || process.env.VITE_READER_DIAGNOSTICS === 'true',
    __DIAGNOSTIC_SOURCE__: JSON.stringify({
      sha:
        process.env.VITE_BUILD_SHA ||
        execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    }),
  },
  plugins: [vue(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}))
