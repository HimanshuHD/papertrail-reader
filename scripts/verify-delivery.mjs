import fs from 'node:fs'
import { verifyCandidate } from './candidate-artifact.mjs'
const plan = JSON.parse(fs.readFileSync('promotion-plan.json', 'utf8'))
const base = process.env.BASE_PATH || '/papertrail-reader/'
const basePath =
  plan.channel === 'preview'
    ? `${base}preview/pr-${plan.pr}/`
    : plan.channel === 'staging'
      ? `${base}staging/`
      : base
const build = await verifyCandidate(`incoming/${plan.channel}`, { ...plan, basePath })
if (plan.baseSha && build.baseSha !== plan.baseSha)
  throw new Error('PR base changed; refresh candidate CI')
fs.writeFileSync('verified-build.json', JSON.stringify(build))
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `publish=${plan.channel === 'preview' || plan.manualRun || build.publish !== false}\n`,
  )
