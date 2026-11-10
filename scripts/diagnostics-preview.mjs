import path from 'node:path'
import { preview } from 'vite'

/** Pass filesystem paths directly to Vite: Playwright's shell must never parse them. */
export async function startDiagnosticPreview(mode, env = process.env, port) {
  if (!['production', 'diagnostic'].includes(mode)) throw new Error('Unknown diagnostic build mode')
  const root = env.DIAGNOSTIC_BUILD_ROOT
  if (!root || !path.isAbsolute(root))
    throw new Error('DIAGNOSTIC_BUILD_ROOT must be an absolute path')
  return preview({
    configFile: false,
    build: { outDir: path.join(root, mode) },
    preview: {
      host: '127.0.0.1',
      port: port ?? (mode === 'production' ? 4176 : 4177),
      strictPort: true,
    },
  })
}
