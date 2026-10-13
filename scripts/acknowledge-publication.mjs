import fs from 'node:fs'
const state = JSON.parse(fs.readFileSync('_site/.deployment-state.json', 'utf8'))
let history = {}
try {
  history = JSON.parse(fs.readFileSync('_site/.deployment-history.json', 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
for (const channel of ['production', 'staging'])
  if (state[channel]?.archiveId) {
    history[channel] ||= {}
    history[channel][state[channel].archiveId] = {
      ...state[channel],
      publishedAt: new Date().toISOString(),
    }
  }
fs.writeFileSync('_site/.deployment-history.json', JSON.stringify(history, null, 2))
fs.writeFileSync('_site/.publication-receipt.json', JSON.stringify(state, null, 2))
