import fs from 'node:fs/promises'
import { verifyVisualArtifact } from './visual-qa-policy.mjs'
const plan = JSON.parse(await fs.readFile('visual-plan.json', 'utf8'))
const build = await verifyVisualArtifact('incoming/preview', plan, process.env.BASE_PATH)
await fs.rm('dist', { recursive: true, force: true })
await fs.cp('incoming/preview', 'dist', { recursive: true })
await fs.mkdir('visual-evidence', { recursive: true })
await fs.writeFile('visual-evidence/candidate.json', JSON.stringify({ plan, build }, null, 2))
if (process.env.GITHUB_OUTPUT)
  await fs.appendFile(process.env.GITHUB_OUTPUT, `base_path=${build.basePath}\n`)
