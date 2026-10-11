import { describe, expect, it } from 'vitest'
import { environmentDatabaseName } from '../../src/services/environment-storage'

describe('deployment storage isolation', () => {
  it('preserves all production database identities', () => {
    for (const name of [
      'papertrail-reading',
      'papertrail-epub-reading',
      'papertrail-annotations',
      'papertrail-workspace',
    ]) {
      expect(environmentDatabaseName(name, '/papertrail-reader/')).toBe(name)
      expect(environmentDatabaseName(name, '/')).toBe(name)
    }
  })
  it('isolates staging and each numbered preview', () => {
    const name = 'papertrail-workspace'
    expect(environmentDatabaseName(name, '/papertrail-reader/staging/')).toBe(name + ':staging')
    expect(environmentDatabaseName(name, '/papertrail-reader/preview/pr-170/')).toBe(
      name + ':preview-170',
    )
    expect(environmentDatabaseName(name, '/preview/pr-171/')).toBe(name + ':preview-171')
  })
})
