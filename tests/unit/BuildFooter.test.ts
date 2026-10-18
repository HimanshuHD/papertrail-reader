import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { version } from '../../package.json'
import BuildFooter from '../../src/components/BuildFooter.vue'

const sha = '1234567890abcdef1234567890abcdef12345678'
const wrappers: ReturnType<typeof mount>[] = []
function footer(env: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({
    VITE_BUILD_SHA: sha,
    VITE_BRANCH_NAME: 'main',
    VITE_PR_NUMBER: '',
    VITE_DEPLOY_CHANNEL: 'production',
    ...env,
  }))
    vi.stubEnv(name, value)
  const wrapper = mount(BuildFooter, { attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}
async function details(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('button[aria-label="Build details"]').trigger('click')
  await flushPromises()
  return document.querySelector<HTMLElement>('[role="region"][aria-label="Build details"]')!
}
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('deployment footer identity', () => {
  it.each([
    ['production', 'Production', 'main', 'Branch'],
    ['staging', 'Staging', 'staging', 'Branch'],
    ['preview', 'Preview', 'feature/reader&polish', 'Branch'],
    ['release', 'Release archive', 'v2.1.1', 'Tag'],
  ])(
    'uses actual %s metadata and moves build links into details',
    async (channel, label, branch, refLabel) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const wrapper = footer({
        VITE_DEPLOY_CHANNEL: channel,
        VITE_BRANCH_NAME: branch,
        VITE_PR_NUMBER: channel === 'preview' ? '38' : '',
      })
      expect(wrapper.text()).toContain(`${label} · v${version}`)
      expect(wrapper.find('a').exists()).toBe(false)
      const panel = await details(wrapper)
      expect(panel.textContent).toContain(refLabel)
      expect(panel.querySelector(`a[href$="/commit/${sha}"]`)?.getAttribute('title')).toBe(sha)
      const refUrl = branch.split('/').map(encodeURIComponent).join('/')
      expect(panel.querySelector(`a[href$="/tree/${refUrl}"]`)?.textContent).toBe(branch)
      expect(Boolean(panel.querySelector('a[href$="/pull/38"]'))).toBe(channel === 'preview')
    },
  )
  it.each(['', 'HEAD', sha, 'bad..ref', 'refs/heads/.hidden', 'bad ref', 'bad/ref.lock'])(
    'does not invent a branch link for %s',
    async (branch) => {
      const panel = await details(footer({ VITE_BRANCH_NAME: branch }))
      expect(panel.querySelector('a[href*="/tree/"]')).toBeNull()
      expect(panel.textContent).toMatch(/Unavailable|Detached revision/)
    },
  )
  it('labels absent metadata honestly without a fabricated commit link', async () => {
    const wrapper = footer({ VITE_BUILD_SHA: '', VITE_BRANCH_NAME: '', VITE_PR_NUMBER: 'invalid' })
    expect(wrapper.text()).toContain('Development · v')
    const panel = await details(wrapper)
    expect(panel.querySelector('a')).toBeNull()
    expect(panel.textContent).toContain('Unavailable')
  })
  it('normalizes tagged and branch refs without presenting a tag as a branch', async () => {
    const panel = await details(
      footer({ VITE_DEPLOY_CHANNEL: 'release', VITE_BRANCH_NAME: 'refs/tags/v2.1.1' }),
    )
    expect(panel.querySelector('dt')?.textContent).toBe('Tag')
    expect(panel.querySelector('a[href$="/tree/v2.1.1"]')).not.toBeNull()
  })
})

it('opens on keyboard activation, reaches links, consumes Escape and restores focus without reopening', async () => {
  const wrapper = footer()
  const button = wrapper.get<HTMLButtonElement>('button')
  button.element.focus()
  await flushPromises()
  expect(button.attributes('aria-expanded')).toBe('false')
  await button.trigger('keydown', { key: 'ArrowDown' })
  await flushPromises()
  const panel = document.querySelector<HTMLElement>('[role="region"][aria-label="Build details"]')!
  expect(panel.contains(document.activeElement)).toBe(true)
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event)
  await flushPromises()
  expect(event.defaultPrevented).toBe(true)
  expect(button.attributes('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(button.element)
  expect(document.querySelector('[role="region"][aria-label="Build details"]')).toBeNull()
})
it('supports Tab into links, Shift+Tab back, and a second click to close', async () => {
  const wrapper = footer()
  const button = wrapper.get<HTMLButtonElement>('button')
  button.element.focus()
  await button.trigger('click')
  await flushPromises()
  await button.trigger('keydown', { key: 'Tab' })
  await flushPromises()
  const panel = document.querySelector<HTMLElement>('[role="region"][aria-label="Build details"]')!
  expect(document.activeElement).toBe(panel.querySelector('a'))
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
  )
  await flushPromises()
  expect(document.activeElement).toBe(button.element)
  expect(button.attributes('aria-expanded')).toBe('false')
  await button.trigger('click')
  expect(button.attributes('aria-expanded')).toBe('true')
  await button.trigger('click')
  expect(button.attributes('aria-expanded')).toBe('false')
})
it('does not open on hover or focus and stays open after pointer leave until dismissed', async () => {
  const wrapper = footer()
  const button = wrapper.get<HTMLButtonElement>('button')
  await button.trigger('mouseenter')
  button.element.focus()
  await flushPromises()
  expect(button.attributes('aria-expanded')).toBe('false')
  expect(document.querySelector('[role="region"][aria-label="Build details"]')).toBeNull()
  await button.trigger('click')
  await flushPromises()
  await button.trigger('mouseleave')
  expect(button.attributes('aria-expanded')).toBe('true')
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  await flushPromises()
  expect(button.attributes('aria-expanded')).toBe('false')
})
it('preserves server-confirmed alignment and published-preview notices', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ aligned: true, productionVersion: '2.1.1' }),
    }),
  )
  const staging = footer({ VITE_DEPLOY_CHANNEL: 'staging' })
  await flushPromises()
  expect(staging.get('[role="status"]').text()).toBe(
    'Staging matches production v2.1.1. No unreleased changes.',
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ draft: true }) }),
  )
  const preview = footer({ VITE_DEPLOY_CHANNEL: 'preview', VITE_PR_NUMBER: '170' })
  await flushPromises()
  expect(preview.get('[role="status"]').text()).toContain('PR currently draft')
})
