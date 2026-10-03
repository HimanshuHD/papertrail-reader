import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import * as prettier from 'prettier'

test('merge reconciliation preserves canonical paths and formatted status tables', async () => {
  const workflow = fs.readFileSync('.github/workflows/merge-tracking.yml', 'utf8')
  const script = workflow
    .split('          script: |\n')[1]
    .split('\n')
    .map((line) => line.replace(/^ {12}/, ''))
    .join('\n')
  const reads = []
  const writes = []
  const issues = [
    {
      number: 100,
      state: 'open',
      body: 'Status: In review — waiting for explicit preview and deployment acceptance',
    },
    { number: 106, state: 'closed', state_reason: 'completed', body: 'Status: Completed' },
  ]
  const github = {
    paginate: async () => issues,
    rest: {
      issues: { listForRepo: () => {}, update: async () => {} },
      repos: {
        getContent: async ({ path }) => {
          reads.push(path)
          return {
            data: {
              sha: 'fixture',
              content: Buffer.from(fs.readFileSync(path)).toString('base64'),
            },
          }
        },
        createOrUpdateFileContents: async (data) => {
          writes.push(data)
        },
      },
    },
  }
  const context = {
    repo: { owner: 'fixture', repo: 'reader' },
    payload: {
      pull_request: {
        merged: true,
        number: 111,
        base: { ref: 'main' },
        body: 'Refs #112',
        merge_commit_sha: 'fixture',
        merged_at: '2026-10-03T00:00:00Z',
        html_url: 'https://github.com/fixture/reader/pull/111',
      },
    },
  }
  await vm.runInNewContext(`(async () => {\n${script}\n})()`, { github, context, Buffer })
  assert.deepEqual(reads, ['docs/trackers/progress.md', 'docs/roadmaps/product-roadmaps.md'])
  const tracker = writes.find((write) => write.path === 'docs/trackers/progress.md')
  assert.ok(tracker)
  for (const write of writes) {
    const markdown = Buffer.from(write.content, 'base64').toString('utf8')
    const options = await prettier.resolveConfig(write.path)
    assert.equal(markdown, await prettier.format(markdown, { ...options, parser: 'markdown' }))
    assert.equal(write.branch, 'main')
  }
  const markdown = Buffer.from(tracker.content, 'base64').toString('utf8')
  assert.match(markdown, /In review — waiting for explicit preview and deployment acceptance/)
  assert.match(markdown, /\[#106\].*\| Completed\s*\|/)
})
