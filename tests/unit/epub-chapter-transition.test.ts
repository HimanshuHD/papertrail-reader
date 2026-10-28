import { expect, it, vi } from 'vitest'
import type Rendition from 'epubjs/types/rendition'
import { keepChapterPainted } from '../../src/features/epub/chapter-transition'
function setup() {
  const container = document.createElement('div')
  document.body.append(container)
  const view = () => {
    const element = document.createElement('div')
    container.append(element)
    return { element, displayed: true, destroy: vi.fn() }
  }
  const old = view()
  let finish!: () => void, fail!: (reason: unknown) => void
  const manager = {
    views: {
      _views: [old],
      length: 1,
      clear() {
        for (const v of this._views) {
          v.destroy()
          v.element.remove()
        }
        this._views = []
        this.length = 0
      },
    },
    clear() {
      this.views.clear()
    },
    createView: view,
    async display() {
      this.clear()
      const next = this.createView()
      this.views._views.push(next)
      this.views.length = 1
      await new Promise<void>((resolve, reject) => {
        finish = resolve
        fail = reject
      })
    },
  }
  const dispose = keepChapterPainted({ manager } as unknown as Rendition)
  return {
    manager,
    old,
    dispose,
    container,
    finish: () => finish(),
    fail: () => fail(new Error('failed')),
  }
}
it('keeps the old surface painted until the replacement is ready without moving its DOM', async () => {
  const s = setup(),
    pending = s.manager.display(),
    next = s.manager.views._views[0]!
  expect(s.old.element.isConnected).toBe(true)
  expect(s.old.destroy).not.toHaveBeenCalled()
  expect(next.element.getAttribute('aria-hidden')).toBe('true')
  s.finish()
  await pending
  expect(s.old.destroy).toHaveBeenCalledOnce()
  expect(s.old.element.isConnected).toBe(false)
  expect(next.element.hasAttribute('aria-hidden')).toBe(false)
  s.dispose()
  s.manager.clear()
  s.container.remove()
})
it('restores the previous surface when replacement fails', async () => {
  const s = setup(),
    pending = s.manager.display()
  s.fail()
  await expect(pending).rejects.toThrow('failed')
  expect(s.manager.views._views).toEqual([s.old])
  expect(s.old.element.isConnected).toBe(true)
  s.dispose()
  s.manager.clear()
  s.container.remove()
})
it('releases the departing surface when disposed during a pending replacement', async () => {
  const s = setup(),
    pending = s.manager.display()
  s.dispose()
  s.manager.clear()
  s.finish()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(s.old.destroy).toHaveBeenCalledOnce()
  expect(s.container.children).toHaveLength(0)
  s.container.remove()
})
