export const profileModes = [
  'production',
  'closed',
  'sampling',
  'paused',
  'expanded',
  'sampling-sensors',
  'expanded-sensors',
  'paused-sensors',
]

export function profileOptions(env = process.env) {
  const modes = env.PROFILE_MODES === undefined ? [...profileModes] : env.PROFILE_MODES.split(',')
  if (
    !modes.length ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !profileModes.includes(mode))
  )
    throw new Error('PROFILE_MODES must contain unique supported profiling modes')
  const browserArgs = JSON.parse(env.PROFILE_CHROMIUM_ARGS || '[]')
  if (
    !Array.isArray(browserArgs) ||
    browserArgs.some((arg) => typeof arg !== 'string' || !arg.startsWith('--'))
  )
    throw new Error('PROFILE_CHROMIUM_ARGS must be a JSON array of Chromium flags')
  return { modes, browserArgs }
}
