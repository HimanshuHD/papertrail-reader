import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeCandidate, verifyCandidate } from './candidate-artifact.mjs'

test('browser verifies a reused candidate against its immutable source, not its docs successor', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'papertrail-browser-source-'))
  const repo = path.join(temporary, 'repo')
  const artifact = path.join(temporary, 'artifact')
  fs.mkdirSync(repo)
  fs.mkdirSync(artifact)
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  const commit = () => {
    git('add', '-A')
    git('commit', '-qm', 'fixture')
    return git('rev-parse', 'HEAD')
  }
  try {
    git('init', '-q')
    git('config', 'user.name', 'Browser source test')
    git('config', 'user.email', 'test@example.invalid')
    fs.writeFileSync(path.join(repo, 'reader.js'), 'accepted reader')
    const candidate = commit()
    const tree = git('rev-parse', 'HEAD^{tree}')
    fs.mkdirSync(path.join(repo, 'docs'))
    fs.writeFileSync(path.join(repo, 'docs', 'evidence.md'), 'later synchronization')
    const successor = commit()
    const successorTree = git('rev-parse', 'HEAD^{tree}')
    assert.notEqual(tree, successorTree)
    const identity = {
      sha: candidate,
      tree,
      headSha: candidate,
      runId: '42',
      pr: '194',
      channel: 'staging',
      basePath: '/papertrail-reader/staging/',
    }
    fs.writeFileSync(path.join(artifact, 'index.html'), 'accepted bytes')
    await writeCandidate(artifact, identity)
    const workflow = fs.readFileSync(
      fileURLToPath(new URL('../.github/workflows/browser-e2e.yml', import.meta.url)),
      'utf8',
    )
    const expression = workflow.match(/ref: \$\{\{ (.+) \}\}/)[1]
    const chooseRef = new Function('inputs', 'github', `return (${expression})`)
    const ref = chooseRef({ source_sha: candidate, source_ref: successor }, { sha: successor })
    git('checkout', '-q', ref)
    await verifyCandidate(artifact, { ...identity, tree: git('rev-parse', 'HEAD^{tree}') })
    assert.equal(ref, candidate)
    await assert.rejects(
      verifyCandidate(artifact, { ...identity, tree: successorTree }),
      /identity mismatch: tree/,
    )
    await assert.rejects(
      verifyCandidate(artifact, { ...identity, headSha: successor }),
      /identity mismatch: headSha/,
    )
    fs.writeFileSync(path.join(artifact, 'index.html'), 'modified bytes')
    await assert.rejects(verifyCandidate(artifact, identity), /checksum mismatch/)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})
