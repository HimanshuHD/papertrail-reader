import { describe, expect, it } from 'vitest'
import { environmentDatabaseName } from '../../src/services/environment-storage'

describe('deployment storage isolation', () => {
  it('preserves all production database identities', () => {
    for (const name of [
      'papertrail-reading',
      'papertrail-epub-reading',
      'papertrail-annotations',
      'papertrail-workspace',
      'papertrail-statistics',
    ]) {
      expect(environmentDatabaseName(name, '/papertrail-reader/')).toBe(name)
      expect(environmentDatabaseName(name, '/')).toBe(name)
    }
  })
  it('isolates staging and each numbered preview', () => {
    for (const name of ['papertrail-workspace', 'papertrail-statistics']) {
      expect(environmentDatabaseName(name, '/papertrail-reader/staging/')).toBe(name + ':staging')
      expect(environmentDatabaseName(name, '/papertrail-reader/preview/pr-170/')).toBe(
        name + ':preview-170',
      )
      expect(environmentDatabaseName(name, '/preview/pr-171/')).toBe(name + ':preview-171')
    }
  })
  it('isolates each immutable release from production, staging and other versions', () => {
    expect(environmentDatabaseName('reading', '/papertrail-reader/releases/v2.2.0/')).toBe(
      'reading:release-v2.2.0',
    )
    expect(environmentDatabaseName('reading', '/papertrail-reader/releases/v2.3.0/')).toBe(
      'reading:release-v2.3.0',
    )
  })
})
