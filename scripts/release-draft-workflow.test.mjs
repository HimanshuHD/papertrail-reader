import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const workflow = await fs.readFile('.github/workflows/release-package.yml', 'utf8')
const script = workflow.split('          script: |\n')[1].replace(/^ {12}/gm, '')
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'github',
  'context',
  'core',
  'require',
  'process',
  script,
)
function fixture({ drafts = [], published, lookupError = 404, collision = false } = {}) {
  const calls = [],
    bytes = Buffer.from('verified package fixture')
  const digest = crypto.createHash('sha256').update(bytes).digest('hex')
  const repos = {
    getReleaseByTag: async () => {
      if (published) return { data: published }
      throw Object.assign(Error('lookup failed'), { status: lookupError })
    },
    listReleases: async () => ({ data: drafts }),
    createRelease: async () => {
      calls.push(['create'])
      return { data: { id: 99, draft: true } }
    },
    listReleaseAssets: async ({ release_id }) => {
      calls.push(['assets', release_id])
      return { data: collision ? [{ id: 3, name: 'papertrail-v2.1.1.json' }] : [] }
    },
    getReleaseAsset: async () => ({ data: Buffer.from('different bytes') }),
    uploadReleaseAsset: async ({ release_id, name }) => {
      calls.push(['upload', release_id, name])
    },
  }
  const github = { rest: { repos }, paginate: async (method, args) => (await method(args)).data }
  const files = {
    'release-output/papertrail-v2.1.1.json': bytes,
    'release-output/papertrail-v2.1.1.json.sha256': digest + '  papertrail-v2.1.1.json\n',
    'release-output/RELEASE-NOTES.md': 'Reviewed notes',
  }
  const summary = { addHeading: () => summary, addRaw: () => summary, write: async () => {} }
  return {
    calls,
    run: () =>
      execute(
        github,
        { repo: { owner: 'owner', repo: 'repo' } },
        { summary },
        (name) => (name === 'node:crypto' ? crypto : { readFileSync: (file) => files[file] }),
        { env: { RELEASE_TAG: 'v2.1.1' } },
      ),
  }
}

test('packaging reuses the exact existing draft when published-tag lookup returns 404', async () => {
  const f = fixture({
    drafts: [
      { id: 7, draft: true, tag_name: 'v2.1.1' },
      { id: 8, draft: true, tag_name: 'v2.1.2' },
    ],
  })
  await f.run()
  assert.deepEqual(f.calls, [
    ['assets', 7],
    ['upload', 7, 'papertrail-v2.1.1.json'],
    ['upload', 7, 'papertrail-v2.1.1.json.sha256'],
  ])
})
test('ambiguous drafts fail before any release or asset mutation', async () => {
  const f = fixture({ drafts: [1, 2].map((id) => ({ id, draft: true, tag_name: 'v2.1.1' })) })
  await assert.rejects(f.run(), /Multiple draft releases/)
  assert.deepEqual(f.calls, [])
})
test('published releases and non-404 lookup errors remain fail-closed', async () => {
  for (const options of [{ published: { id: 7, draft: false } }, { lookupError: 403 }]) {
    const f = fixture(options)
    await assert.rejects(f.run())
    assert.deepEqual(f.calls, [])
  }
})
test('a new draft is created only when no exact draft exists', async () => {
  const f = fixture({ drafts: [{ id: 8, draft: true, tag_name: 'v2.1.2' }] })
  await f.run()
  assert.equal(f.calls.filter((c) => c[0] === 'create').length, 1)
  assert.equal(f.calls.filter((c) => c[0] === 'upload').length, 2)
})
test('reused draft asset collisions cannot overwrite existing bytes', async () => {
  const f = fixture({ drafts: [{ id: 7, draft: true, tag_name: 'v2.1.1' }], collision: true })
  await assert.rejects(f.run(), /Immutable asset collision/)
  assert.deepEqual(f.calls, [['assets', 7]])
})
