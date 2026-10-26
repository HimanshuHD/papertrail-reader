// Environment-only probe for ready staging PRs that change browser CI setup.
// No documents, E2E suite, baseline comparison, deployment or secrets are passed in.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function needsBrowserPreflight(paths) {
  return paths.some((value) =>
    [
      '.github/workflows/browser-e2e.yml',
      '.github/workflows/ci.yml',
      'scripts/browser-evidence.mjs',
      'scripts/browser-container-preflight.mjs',
    ].includes(value),
  )
}

export function browserContainerArgs(workflow, workspace) {
  const image = workflow.match(
    /image: (mcr\.microsoft\.com\/playwright:v[\d.]+-noble@sha256:[a-f0-9]{64})/,
  )[1]
  const home = workflow.match(/^ {6}HOME: (\S+)$/m)?.[1]
  if (home !== '/root') throw new Error('Root browser container requires owned HOME=/root')
  const trust = workflow.match(
    /name: Trust checked-out workspace in container[\s\S]*?run: ([^\n]+)/,
  )[1]
  if (trust !== 'HOME=/root git config --global --add safe.directory "$GITHUB_WORKSPACE"')
    throw new Error('Expected workspace-only Git trust')
  const probe = [
    trust,
    `node -e "const fs=require('node:fs'),os=require('node:os');if(fs.statSync(os.homedir()).uid!==process.getuid())throw Error('Browser HOME owner mismatch')"`,
    'node scripts/browser-evidence.mjs',
    `node -e "console.log('Browser environment preflight passed:',JSON.stringify(require('./browser-evidence/environment.json').engines))"`,
  ].join('\n')
  return [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    '--user',
    '0:0',
    '--env',
    `HOME=${home}`,
    '--env',
    'GITHUB_WORKSPACE=/workspace',
    '--env',
    'E2E_ENVIRONMENT_PREFLIGHT=true',
    '--mount',
    `type=bind,source=${workspace},target=/workspace`,
    '--workdir',
    '/workspace',
    image,
    'sh',
    '-ec',
    probe,
  ]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.env.BROWSER_PREFLIGHT_BASE_SHA
  if (!/^[a-f0-9]{40}$/i.test(base ?? '')) throw new Error('A full PR base SHA is required')
  const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })
    .trim()
    .split('\n')
  if (!needsBrowserPreflight(changed)) {
    console.log('Browser environment unchanged; preflight skipped.')
  } else {
    const workflow = fs.readFileSync('.github/workflows/browser-e2e.yml', 'utf8')
    const workspace = process.cwd()
    if (workspace.includes(',')) throw new Error('Docker mount workspace cannot contain commas')
    execFileSync('docker', browserContainerArgs(workflow, workspace), {
      stdio: 'inherit',
      timeout: 280000,
    })
  }
}
