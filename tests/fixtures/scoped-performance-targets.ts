import {
  defaultIndicatorConfig,
  type IndicatorConfig,
  type Target,
} from '../../src/features/diagnostics/indicators'
import type { OperationProfile } from '../../src/features/diagnostics/operation-profiles'

export const fixtureTargetVersion = 'roadmap-3-fixture-targets-v1'
export const fixtureBrowser = {
  engine: 'chromium',
  version: '153.0.8010.0',
  platform: 'linux',
  graphics: 'swiftshader',
  width: 1440,
  height: 900,
  headless: true,
  reducedMotion: 'reduce',
  diagnostics: 'minimized',
  sensors: false,
} as const

export const fixtureTargets = {
  'directory-1000': { profile: 'library.scan', attentionMs: 475, criticalMs: 950 },
  'text-pdf-1001': { profile: 'pdf.cold-open', attentionMs: 425, criticalMs: 850 },
  'styled-epub-1000': { profile: 'epub.cold-open', attentionMs: 400, criticalMs: 800 },
} as const satisfies Record<string, Target & { profile: OperationProfile }>

export type TargetFixture = keyof typeof fixtureTargets

type FixtureScope = {
  [K in keyof typeof fixtureBrowser]: (typeof fixtureBrowser)[K] extends string
    ? string
    : (typeof fixtureBrowser)[K] extends number
      ? number
      : boolean
} & { fixture: string }

/** The harness owns fixture provenance. Only its generated inputs enter this evaluation. */
export function fixtureTargetConfiguration(scope: FixtureScope): IndicatorConfig | null {
  if (
    !Object.hasOwn(fixtureTargets, scope.fixture) ||
    !(Object.keys(fixtureBrowser) as (keyof typeof fixtureBrowser)[]).every(
      (key) => scope[key] === fixtureBrowser[key],
    )
  )
    return null

  const { profile, attentionMs, criticalMs } = fixtureTargets[scope.fixture as TargetFixture]
  return {
    ...defaultIndicatorConfig(),
    operations: { [profile]: { attentionMs, criticalMs } },
  }
}
