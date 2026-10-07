import { expect, test } from '@playwright/test'
import type { Page, TestInfo, Locator } from '@playwright/test'
import {
  createEpubFixture,
  createFormattedEpubFixture,
  createContentsEpubFixture,
} from '../fixtures/epub'

test.beforeEach(({ browser }, info) => {
  info.annotations.push({ type: 'browser-version', description: browser.version() })
})

test('EPUB text reader sanitizes local chapters, navigates and disposes on source changes', async ({
  page,
}, info) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('evil.invalid')) external.push(request.url())
  })
  await page.goto('./#/app')
  const chapter =
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title><link rel="stylesheet" href="https://evil.invalid/style"/></head><body onload="window.parent.epubAttack=1"><h1>First chapter</h1><p>Local reading text.</p><script>window.parent.epubAttack=1</script><img src="https://evil.invalid/image"/><iframe src="https://evil.invalid/frame"/><style>@import url(https://evil.invalid/style);</style><a href="https://evil.invalid/link">External link text</a></body></html>'
  const good = {
    name: 'safe.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  }
  const broken = {
    name: 'broken.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from('not a book'),
  }
  await page.locator('input[accept*=".pdf"]').setInputFiles([good, broken])
  const library = page.locator('section[aria-labelledby="local-library-title"]')
  await expect(library.getByRole('button', { name: /safe.epub/ })).toBeVisible()
  await library.getByRole('button', { name: /safe.epub/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  await expect(reader.getByRole('heading', { name: 'Local test book' })).toBeVisible()
  const openerBounds = await page.getByRole('button', { name: 'Show library' }).boundingBox()
  const titleBounds = await reader.getByRole('heading', { name: 'Local test book' }).boundingBox()
  expect(titleBounds!.x).toBeGreaterThanOrEqual(openerBounds!.x + openerBounds!.width + 12)
  const frame = reader.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'First chapter' })).toBeVisible()
  await expect(reader.locator('iframe')).toHaveAttribute('sandbox', 'allow-same-origin')
  expect(await frame.locator('script,img,iframe,style[src],link[href^="https:"]').count()).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, 'epubAttack'))).toBeUndefined()
  await reader.getByRole('button', { name: 'Next chapter' }).click()
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await reader.getByRole('button', { name: 'Previous chapter' }).click()
  await expect(frame.getByRole('heading', { name: 'First chapter' })).toBeVisible()
  await capture(page, info, 'epub-text-reader-light')
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(228, 237, 243)')
  await capture(page, info, 'epub-text-reader')
  await page.getByRole('button', { name: 'Show library' }).click()
  await library.getByRole('button', { name: /broken.epub/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(reader.getByRole('alert')).toContainText('EPUB archive size is unsupported.')
  await expect(reader.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show library' }).click()
  await library.getByRole('button', { name: /safe.epub/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(frame.getByRole('heading', { name: 'First chapter' })).toBeVisible()
  // Replacing the source tears down the current engine and its iframe.
  await page.getByRole('button', { name: 'Show library' }).click()
  await page
    .getByRole('complementary', { name: 'Document library' })
    .locator('input[accept*=".pdf"]')
    .setInputFiles({
      name: 'replacement.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(),
    })
  await expect(page.locator('.epub-host iframe')).toHaveCount(0)
  await noOverflow(page)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})

test('EPUB reflows during live resizing without scroll and stays within the reader', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./#/app')
  const text =
    'Responsive chapter text should wrap immediately when the reading space changes. '.repeat(40)
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Resize chapter</title></head><body><h1>Resize chapter</h1><p>${text}</p><pre>${'long-token-'.repeat(100)}</pre></body></html>`
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'resize.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  })
  await page
    .locator('section[aria-labelledby="local-library-title"]')
    .getByRole('button', { name: /resize.epub/ })
    .click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  const frame = reader.frameLocator('iframe')
  await expect(frame.getByRole('heading', { name: 'Resize chapter' })).toBeVisible()
  await reader.locator('iframe').evaluate((el) => el.setAttribute('data-resize-owner', 'original'))
  const heights: number[] = []
  for (const width of [1024, 320, 900, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(frame.getByRole('heading', { name: 'Resize chapter' })).toBeVisible()
    await expect
      .poll(async () => {
        const availableWidth = await reader
          .locator('.epub-container')
          .evaluate((el) => el.clientWidth)
        const hostWidth = await reader.locator('.epub-host').evaluate((el) => el.clientWidth)
        const containerWidth = await reader
          .locator('.epub-container')
          .evaluate((el) => el.getBoundingClientRect().width)
        const iframe = await reader.locator('iframe').boundingBox()
        return iframe
          ? Math.max(Math.abs(availableWidth - iframe.width), Math.abs(containerWidth - hostWidth))
          : 10000
      })
      .toBeLessThanOrEqual(2)
    await expect
      .poll(() => frame.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
      .toBe(true)
    await expect(reader.locator('iframe')).toHaveAttribute('data-resize-owner', 'original')
    await expect
      .poll(() =>
        reader.locator('.epub-container').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      )
      .toBe(true)
    heights.push(await frame.locator('p').evaluate((el) => el.getBoundingClientRect().height))
    await noOverflow(page)
  }
  expect(heights[1]!).toBeGreaterThan(heights[0]!)
  expect(heights[2]!).toBeLessThan(heights[1]!)
  await reader.getByRole('button', { name: 'Next chapter' }).click()
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await page.setViewportSize({ width: 768, height: 700 })
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await expect
    .poll(() => frame.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true)
  await reader.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 700 })
  await expect
    .poll(() => frame.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true)
  await expect(reader.locator('.epub-container')).toHaveCSS('overflow-x', 'hidden')
  await expect(page.locator('.reader-content')).toHaveCSS('overflow-x', 'hidden')
  await expect(frame.locator('html')).toHaveCSS('overflow-x', 'hidden')
  expect(errors).toEqual([])
})

test('EPUB preserves local formatting by default and keeps mode anchors and side controls', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'formatted.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createFormattedEpubFixture()),
  })
  await page
    .locator('section[aria-labelledby="local-library-title"]')
    .getByRole('button', { name: /formatted.epub/ })
    .click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  const frame = reader.frameLocator('iframe')
  const toggle = reader.getByRole('switch', { name: 'Text-only view' })
  await expect(frame.getByRole('heading', { name: 'Formatted chapter' })).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(frame.locator('.intro')).toHaveCSS('text-align', 'center')
  await expect(frame.locator('body')).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(frame.locator('.intro')).toHaveCSS('padding-top', '12px')
  await expect(frame.locator('img')).toBeVisible()
  await expect
    .poll(() =>
      frame.locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true)
  const next = reader.getByRole('button', { name: 'Next chapter' })
  const before = await next.boundingBox()
  await expect
    .poll(() =>
      reader.locator('.epub-container').evaluate((el) => el.scrollHeight - el.clientHeight),
    )
    .toBeGreaterThan(500)
  await expect
    .poll(async () => {
      await reader.locator('.epub-container').evaluate((el) => {
        el.dispatchEvent(new WheelEvent('wheel'))
        el.scrollTop = 500
      })
      return reader.locator('.epub-container').evaluate((el) => el.scrollTop)
    })
    .toBeGreaterThan(100)
  await expect
    .poll(() => reader.locator('.epub-container').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100)
  expect((await next.boundingBox())!.y).toBe(before!.y)
  const anchor = await epubTextPoint(reader)
  await toggle.click()
  await expect(frame.locator('img')).toHaveCount(0)
  await expect(frame.locator('p').first()).toHaveCSS('text-align', 'start')
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await next.click()
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await toggle.click()
  await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
  await expect(reader.locator('header')).toContainText('Chapter 2 of 2')
  await reader.getByRole('button', { name: 'Previous chapter' }).click()
  await expect(frame.locator('img')).toBeVisible()
  await page.setViewportSize({ width: 320, height: 700 })
  await expect
    .poll(() => frame.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
    .toBe(true)
  await expect(next).toBeVisible()
  await noOverflow(page)
})

for (const kind of ['nav', 'ncx'] as const) {
  test(`EPUB ${kind} contents and typography work in both modes without replacing the frame`, async ({
    page,
  }, info) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('evil.invalid')) requests.push(request.url())
    })
    await page.goto('./#/app')
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: `contents-${kind}.epub`,
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createContentsEpubFixture(kind)),
    })
    await page
      .locator('section[aria-labelledby="local-library-title"]')
      .getByRole('button', { name: new RegExp(`contents-${kind}.epub`) })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    const reader = page.getByRole('region', { name: 'EPUB reader' })
    const frame = reader.frameLocator('iframe')
    await expect(frame.getByRole('heading', { name: 'First chapter' })).toBeVisible()
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    const contents = reader.getByRole('navigation', { name: 'EPUB contents' })
    await expect(contents.getByText('Part One', { exact: true })).toBeVisible()
    await reader
      .locator('iframe')
      .evaluate((el) => el.setAttribute('data-typography-owner', 'original'))
    await contents.getByRole('button', { name: 'Later section' }).click()
    await reader.getByRole('button', { name: 'Close utility panel' }).click()
    await expect(frame.getByRole('heading', { name: 'Later section' })).toBeVisible()
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    await expect(contents.getByRole('button', { name: 'Later section' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    await expect(reader.locator('iframe')).toHaveAttribute('data-typography-owner', 'original')
    await contents.getByRole('button', { name: 'Introduction' }).click()
    await reader.getByRole('button', { name: 'Close utility panel' }).click()
    await reader.getByRole('button', { name: 'Typography', exact: true }).click()
    await expect(reader.getByLabel('Font size', { exact: true })).toContainText(
      'Book default (16 px)',
    )
    await reader.getByRole('button', { name: 'Increase font size' }).click()
    await reader.getByRole('button', { name: 'Increase font size' }).click()
    await reader.getByRole('button', { name: 'Increase font size' }).click()
    await reader
      .getByRole('group', { name: 'Line spacing' })
      .getByRole('button', { name: 'Spacious' })
      .click()
    if (page.viewportSize()!.width >= 640) {
      await reader
        .getByRole('group', { name: 'Reading width' })
        .getByRole('button', { name: 'Narrow' })
        .click()
    } else await expect(reader.getByRole('group', { name: 'Reading width' })).toHaveCount(0)
    await expect(frame.locator('p').first()).toHaveCSS('font-size', '22px')
    await expect(frame.locator('p').first()).toHaveCSS('line-height', '44px')
    await expect(frame.locator('p').first()).toHaveCSS('color', 'rgb(18, 52, 86)')
    await expect(reader.locator('iframe')).toHaveAttribute('data-typography-owner', 'original')
    if (page.viewportSize()!.width >= 640)
      await expect
        .poll(() => frame.locator('body').evaluate((el) => el.getBoundingClientRect().width))
        .toBeLessThanOrEqual(481)
    const area = await reader.locator('.epub-container').boundingBox()
    await page.mouse.click(area!.x + area!.width / 2, area!.y + area!.height - 20)
    await expect(reader.getByRole('heading', { name: 'Typography', exact: true })).toHaveCount(0)
    await reader.getByRole('switch', { name: 'Text-only view' }).click()
    await expect(frame.getByRole('heading', { name: 'First chapter' })).toBeVisible()
    await expect(frame.locator('p').first()).toHaveCSS('font-size', '22px')
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    await contents.getByRole('button', { name: 'Later section' }).click()
    await reader.getByRole('button', { name: 'Close utility panel' }).click()
    await expect(frame.getByRole('heading', { name: 'Later section' })).toBeVisible()
    await reader.getByRole('switch', { name: 'Text-only view' }).click()
    await expect(frame.locator('p').first()).toHaveCSS('font-size', '22px')
    await reader.getByRole('button', { name: 'Typography', exact: true }).click()
    await reader.getByRole('button', { name: 'Reset typography' }).click()
    await reader.getByRole('button', { name: 'Close typography' }).click()
    await expect(frame.locator('p').first()).toHaveCSS('font-size', '16px')
    await expect(frame.locator('p').first()).toHaveCSS('color', 'rgb(18, 52, 86)')
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    await contents.getByRole('button', { name: 'Next chapter', exact: true }).click()
    await reader.getByRole('button', { name: 'Close utility panel' }).click()
    await expect(frame.getByRole('heading', { name: 'Second chapter' })).toBeVisible()
    await expect(reader.locator('header')).toContainText('Chapter 2 of 2')
    await reader.getByRole('button', { name: 'Contents', exact: true }).click()
    await expect(
      contents.getByRole('button', { name: 'Next chapter', exact: true }),
    ).toHaveAttribute('aria-current', 'location')
    await page.getByRole('button', { name: 'Dark mode' }).click()
    await noOverflow(page)
    await capture(page, info, `epub-${kind}-contents-typography`)
    expect(requests).toEqual([])
  })
}

async function epubTextPoint(reader: Locator) {
  return reader.locator('iframe').evaluate((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument!
    const container = frame.closest('.epub-container')!
    const top = container.getBoundingClientRect().top - frame.getBoundingClientRect().top
    const caret = doc.caretRangeFromPoint(32, Math.max(0, top + 8))!
    const element = caret.startContainer.parentElement!.closest('[data-reader-node]')!
    const walker = doc.createTreeWalker(element, 4)
    let character = caret.startOffset
    let node: Node | null
    while ((node = walker.nextNode()) && node !== caret.startContainer) {
      if (!node.parentElement?.closest('[data-reader-image]')) character += node.textContent!.length
    }
    const range = doc.createRange()
    range.setStart(caret.startContainer, caret.startOffset)
    range.setEnd(
      caret.startContainer,
      Math.min(caret.startOffset + 1, caret.startContainer.textContent!.length),
    )
    return {
      id: element.getAttribute('data-reader-node')!,
      character,
      offset: range.getBoundingClientRect().top - top,
    }
  })
}
async function epubTextOffset(
  reader: Locator,
  anchor: { id: string; character: number; offset: number },
) {
  return reader.locator('iframe').evaluate((frame: HTMLIFrameElement, saved) => {
    const doc = frame.contentDocument!
    const element = doc.querySelector(`[data-reader-node="${saved.id}"]`)!
    const walker = doc.createTreeWalker(element, 4)
    let character = saved.character
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('[data-reader-image]')) continue
      if (character < node.textContent!.length) break
      character -= node.textContent!.length
    }
    const range = doc.createRange()
    range.setStart(node!, character)
    range.setEnd(node!, Math.min(character + 1, node!.textContent!.length))
    return (
      range.getBoundingClientRect().top +
      frame.getBoundingClientRect().top -
      frame.closest('.epub-container')!.getBoundingClientRect().top
    )
  }, anchor)
}

test('EPUB retains a character inside a long paragraph through typography, panels, resize and modes', async ({
  page,
}) => {
  await page.goto('./#/app')
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Long chapter</title></head><body><h1>Long chapter</h1><p>${'Long paragraph reading location with several words. '.repeat(500)}</p></body></html>`
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'location.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(createEpubFixture({ chapter })),
  })
  await page
    .locator('section[aria-labelledby="local-library-title"]')
    .getByRole('button', { name: /location.epub/ })
    .click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Long chapter' }),
  ).toBeVisible()
  await reader.locator('.epub-container').evaluate((el) => {
    el.dispatchEvent(new WheelEvent('wheel'))
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))
  })
  const anchor = await epubTextPoint(reader)
  expect(anchor.character).toBeGreaterThan(0)
  await reader
    .locator('iframe')
    .evaluate((el) => el.setAttribute('data-location-owner', 'original'))
  await reader.getByRole('button', { name: 'Typography', exact: true }).click()
  await reader.getByRole('button', { name: 'Increase font size' }).click()
  await reader
    .getByRole('group', { name: 'Line spacing' })
    .getByRole('button', { name: 'Spacious' })
    .click()
  if (page.viewportSize()!.width >= 640)
    await reader
      .getByRole('group', { name: 'Reading width' })
      .getByRole('button', { name: 'Narrow' })
      .click()
  await reader.getByRole('button', { name: 'Close typography' }).click()
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await expect(reader.locator('iframe')).toHaveAttribute('data-location-owner', 'original')
  await reader.getByRole('button', { name: 'Contents', exact: true }).click()
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await reader.getByRole('button', { name: 'Close utility panel' }).click()
  await page.setViewportSize({ width: 375, height: 700 })
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await expect(reader.locator('iframe')).toHaveAttribute('data-location-owner', 'original')
  await reader.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Long chapter' }),
  ).toBeVisible()
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await noOverflow(page)
})

test('EPUB progress, settings and bookmarks survive reload/reselection and isolate changed content', async ({
  page,
}) => {
  await page.goto('./#/app')
  const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Continuity</title></head><body><h1>Continuity</h1><p>${'A saved reading point within a long chapter. '.repeat(500)}</p></body></html>`
  const bytes = Buffer.from(createEpubFixture({ chapter }))
  const pick = async (name: string, buffer = bytes) => {
    const show = page.getByRole('button', { name: 'Show library' })
    if (await show.isVisible()) await show.click()
    await page
      .locator('input[accept*=".pdf"]')
      .setInputFiles({ name, mimeType: 'application/epub+zip', buffer })
    await page
      .locator('section[aria-labelledby="local-library-title"]')
      .getByRole('button', { name: `EPUB: ${name}`, exact: true })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
  }
  await pick('saved.epub')
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Continuity' }),
  ).toBeVisible()
  await reader.locator('.epub-container').evaluate((el) => {
    el.dispatchEvent(new WheelEvent('wheel'))
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))
  })
  const anchor = await epubTextPoint(reader)
  await reader.getByRole('button', { name: 'Typography', exact: true }).click()
  await reader.getByRole('button', { name: 'Increase font size' }).click()
  const size = await reader.getByLabel('Font size', { exact: true }).textContent()
  await reader.getByRole('button', { name: 'Close typography' }).click()
  await reader.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await reader.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await reader.getByLabel('Bookmark name', { exact: true }).fill('My place')
  await reader.getByRole('button', { name: 'Save current place' }).click()
  await expect(reader.getByRole('button', { name: 'Go to bookmark My place' })).toBeVisible()
  await reader.getByRole('button', { name: 'Close utility panel' }).click()
  // A visibility transition flushes pending metadata before a page exits; bytes are reselected.
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pagehide')))
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve, reject) => {
            const request = indexedDB.open('papertrail-epub-reading', 1)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const database = request.result
              const transaction = database.transaction('documents')
              const read = transaction.objectStore('documents').getAll()
              read.onsuccess = () => resolve(Boolean(read.result[0]?.location))
              transaction.oncomplete = () => database.close()
            }
          }),
      ),
    )
    .toBe(true)
  await page.reload()
  await pick('renamed.epub')
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Continuity' }),
  ).toBeVisible()
  await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect.poll(() => epubTextOffset(reader, anchor)).toBeCloseTo(anchor.offset, 0)
  await reader.getByRole('button', { name: 'Typography', exact: true }).click()
  await expect(reader.getByLabel('Font size', { exact: true })).toHaveText(size!)
  await reader.getByRole('button', { name: 'Close typography' }).click()
  await reader.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await reader.getByRole('button', { name: 'Rename bookmark My place' }).click()
  await reader.getByLabel('New bookmark name', { exact: true }).fill('Renamed place')
  await reader.getByRole('button', { name: 'Save name' }).click()
  await reader.getByRole('button', { name: 'Go to bookmark Renamed place' }).click()
  await reader.getByRole('button', { name: 'Remove bookmark Renamed place' }).click()
  await expect(reader.getByRole('button', { name: 'Go to bookmark Renamed place' })).toHaveCount(0)
  await reader.getByRole('button', { name: 'Close utility panel' }).click()
  await pick(
    'renamed.epub',
    Buffer.from(
      createEpubFixture({ chapter: chapter.replace('Continuity</h1>', 'Changed book</h1>') }),
    ),
  )
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'Changed book' }),
  ).toBeVisible()
  await expect(reader.getByRole('switch', { name: 'Text-only view' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await reader.getByRole('button', { name: 'Bookmarks', exact: true }).click()
  await expect(reader.getByRole('button', { name: 'Go to bookmark Renamed place' })).toHaveCount(0)
  await noOverflow(page)
})

for (const version of ['2.0', '3.0'] as const) {
  test(`EPUB ${version} RTL tables and layouts stay bounded in both modes`, async ({
    page,
  }, info) => {
    const requests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('evil.invalid')) requests.push(request.url())
    })
    await page.goto('./#/app')
    const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>RTL layout</title><style>.layout{display:grid;grid-template-columns:1fr 1fr;gap:12px}td{color:#123456}</style></head><body dir="rtl"><h1>RTL layout</h1><div class="layout"><p>مرحبا بالعالم</p><p>Local layout text</p></div><table style="width:1400px"><tr><td>${'LongCell'.repeat(80)}</td><td>Table text</td></tr></table><p>${'نص طويل للقراءة '.repeat(100)}</p><img src="https://evil.invalid/image"/></body></html>`
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'rtl.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ version, chapter })),
    })
    await page.getByRole('button', { name: 'EPUB: rtl.epub', exact: true }).click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    const reader = page.getByRole('region', { name: 'EPUB reader' })
    const frame = reader.frameLocator('iframe')
    await expect(frame.getByRole('heading', { name: 'RTL layout' })).toBeVisible()
    await expect(frame.locator('body')).toHaveAttribute('dir', 'rtl')
    await expect(frame.locator('.layout')).toHaveCSS('display', 'grid')
    for (const mode of [false, true]) {
      if (mode) await reader.getByRole('switch', { name: 'Text-only view' }).click()
      await expect(frame.getByRole('heading', { name: 'RTL layout' })).toBeVisible()
      await expect
        .poll(() => frame.locator('html').evaluate((el) => el.scrollWidth <= el.clientWidth + 1))
        .toBe(true)
      await expect(reader.getByRole('button', { name: 'Previous chapter' })).toBeDisabled()
      await expect(reader.getByRole('button', { name: 'Next chapter' })).toBeEnabled()
      await noOverflow(page)
      await capture(page, info, `epub-${version}-${mode ? 'text' : 'formatted'}-rtl-light`)
    }
    await page.getByRole('button', { name: 'Dark mode' }).click()
    await capture(page, info, `epub-${version}-rtl-dark`)
    expect(requests).toEqual([])
  })
}

test('EPUB storage failure and unsupported books recover without remote access', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB)
    indexedDB.open = (name, version) => {
      if (name === 'papertrail-epub-reading')
        throw new DOMException('Storage unavailable', 'QuotaExceededError')
      return version === undefined ? open(name) : open(name, version)
    }
  })
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'good.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture()),
    },
    {
      name: 'fixed.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ fixed: true })),
    },
    {
      name: 'encrypted.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(createEpubFixture({ encrypted: true })),
    },
  ])
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  await page.getByRole('button', { name: 'EPUB: good.epub', exact: true }).click()
  await expect(
    reader.frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
  ).toBeVisible()
  await expect(
    reader.getByRole('status').filter({ hasText: 'storage is unavailable' }),
  ).toBeVisible()
  for (const name of ['fixed.epub', 'encrypted.epub']) {
    await page.getByRole('button', { name: `EPUB: ${name}`, exact: true }).click()
    await expect(reader.getByRole('alert')).toBeVisible()
    await expect(reader.locator('iframe')).toHaveCount(0)
    await page.getByRole('button', { name: 'EPUB: good.epub', exact: true }).click()
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: 'First chapter' }),
    ).toBeVisible()
  }
})

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    )
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await info.attach(name, { path, contentType: 'image/png' })
}

function createPdfFixture(
  pageCount = 2,
  title?: string,
  searchFixture = false,
  rotation = 0,
): Buffer {
  const pageIds = Array.from({ length: pageCount }, (_, i) => 4 + i * 2)
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  for (let i = 0; i < pageCount; i++) {
    const label = i === 0 ? 'First page' : i === 1 ? 'Second page' : `Page ${i + 1}`
    const stream =
      searchFixture && i === 1
        ? `BT /F1 5 Tf 72 720 Td (${'A'.repeat(70)} Needle ${'B'.repeat(70)}) Tj 0 -560 Td (needle) Tj 0 -20 Td (wrapped) Tj 0 -20 Td (match <img>) Tj ET`
        : `BT /F1 24 Tf 72 720 Td (${label}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i]! + 1} 0 R >>`,
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    )
  }

  const infoId = title ? objects.push(`<< /Title (${title}) >>`) : null
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${infoId ? `/Info ${infoId} 0 R` : ''} >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'ascii')
}

test('PDF highlights and notes persist through the contextual toolbar and annotation drawer', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  const select = async (name: string, buffer: Buffer) => {
    const show = page.getByRole('button', { name: 'Show library' })
    if (await show.isVisible()) await show.click()
    await page
      .locator('input[accept*=".pdf"]')
      .setInputFiles({ name, mimeType: 'application/pdf', buffer })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `PDF: ${name}`, exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('button', { name: 'Hide library' }).click()
  }
  const bytes = createPdfFixture(2, undefined, true)
  await select('highlights.pdf', bytes)
  await page.locator('#pdf-page-2').scrollIntoViewIfNeeded()
  await expect(page.locator('#pdf-page-2')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
    const first = document.querySelector('#pdf-page-1 .textLayer span')!.firstChild!
    const last = [...document.querySelectorAll('#pdf-page-2 .textLayer span')].at(-1)!.firstChild!
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(last, last.textContent!.length)
    document.getSelection()!.removeAllRanges()
    document.getSelection()!.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'PDF annotations panel' })
  const entries = panel.locator('[data-annotation-id]')
  await expect(panel).toHaveCount(0)
  await page.locator('#pdf-selection-note').fill('A persistent PDF note')
  await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
  await page.locator('#pdf-page-2 .reader-note-indicator').click()
  await expect(entries).toHaveCount(1)
  await expect(entries.first()).toContainText('A persistent PDF note')
  await verifyAnnotationOverview(page, info, 'PDF')
  await panel.locator('[data-menu-id]').first().click()
  await page.locator('.floating-popover select').first().selectOption('pink')
  await capture(page, info, 'pdf-annotation-notes')
  await page.reload()
  await select('renamed-highlights.pdf', bytes)
  const toggle = page.getByRole('button', { name: 'Annotations', exact: true })
  if (!(await panel.isVisible())) await toggle.click()
  await expect(entries).toHaveCount(1)
  await panel.locator('[data-menu-id]').first().click()
  // Reflow of the sibling document pane must not dismiss an anchored panel menu.
  await page.locator('.pdf-scroll').dispatchEvent('scroll')
  await expect(
    page.locator('.floating-popover').getByRole('button', { name: 'Edit note', exact: true }),
  ).toBeVisible()
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Edit note', exact: true })
    .click()
  await expect(page.locator('.floating-popover').getByLabel('Note', { exact: true })).toHaveValue(
    'A persistent PDF note',
  )
  await page.keyboard.press('Escape')
  await expect(page.locator('.floating-popover')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.locator('#pdf-page-1 .pdf-saved-highlight').first()).toHaveCSS(
    'background-color',
    'rgb(251, 207, 232)',
  )
  await select('changed.pdf', createPdfFixture(3))
  if (!(await panel.isVisible())) await toggle.click()
  await expect(entries).toHaveCount(0)
  await select('original-again.pdf', bytes)
  if (!(await panel.isVisible())) await toggle.click()
  await expect(entries).toHaveCount(1)
  await panel.locator('[data-menu-id]').first().click()
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Delete highlight and note', exact: true })
    .click()
  await expect(entries).toHaveCount(0)
  await page.reload()
  await select('deleted.pdf', bytes)
  if (!(await panel.isVisible())) await toggle.click()
  await expect(entries).toHaveCount(0)
  await noOverflow(page)
})

test('PDF highlights align on rotated pages and rebuild after virtualized rendering', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'rotated.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(8, undefined, false, 90),
  })
  await page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name: 'PDF: rotated.pdf', exact: true })
    .click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const layer = page.locator('#pdf-page-1 .textLayer')
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await layer.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element.querySelector('span')!)
    document.getSelection()!.removeAllRanges()
    document.getSelection()!.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.getByRole('button', { name: 'Add highlight', exact: true }).click()
  const overlay = page.locator('#pdf-page-1 .pdf-saved-highlight').first()
  await expect(overlay).toBeVisible()
  const aligned = async () => {
    const expected = await layer.locator('span').first().boundingBox(),
      actual = await overlay.boundingBox()
    expect(Math.abs(actual!.x - expected!.x)).toBeLessThan(3)
    expect(Math.abs(actual!.y - expected!.y)).toBeLessThan(3)
  }
  await aligned()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await aligned()
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).fill('8')
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).press('Tab')
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'pending')
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).fill('1')
  await page.getByRole('spinbutton', { name: 'Current page', exact: true }).press('Tab')
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await expect(overlay).toBeVisible()
  await aligned()
  await capture(page, info, 'pdf-rotated-highlight')
  await noOverflow(page)
})

test('home and app respond in both themes without overflow', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'The foundation is ready' })).toBeVisible()
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: 'Dark mode' })
    if ((await toggle.getAttribute('aria-pressed')) !== String(theme === 'dark'))
      await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await noOverflow(page)
    await capture(page, info, `home-${theme}`)
    await page.getByRole('link', { name: 'Go to app' }).click()
    await expect(page).toHaveURL(/#\/app$/)
    await expect(page.locator('#reader-title')).toBeVisible()
    await noOverflow(page)
    const sidebar = await page.getByRole('complementary').boundingBox()
    const title = await page.locator('#reader-title').boundingBox()
    expect(sidebar).not.toBeNull()
    expect(title).not.toBeNull()
    expect(title!.width).toBeGreaterThan(200)
    if (page.viewportSize()!.width >= 1024)
      expect(title!.x).toBeGreaterThan(sidebar!.x + sidebar!.width)
    else {
      expect(sidebar!.height).toBeGreaterThan(0)
      expect(sidebar!.y + sidebar!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    }
    await capture(page, info, `app-${theme}`)
    await page.getByRole('link', { name: 'PaperTrail home' }).click()
  }
  expect(errors).toEqual([])
})

test('empty reader survives sidebar collapse and source actions remain available', async ({
  page,
}) => {
  await page.goto('./#/app')
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')
  await expect(page.getByRole('heading', { name: 'No documents selected yet' })).toBeVisible()
  await expect(page.getByText('A quiet space for your next chapter')).toBeVisible()
  await expect(page.getByText('Getting started')).toHaveCount(0)
  await expect(page.getByText('Demonstration workspace')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Contents' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Add local documents' }).click()
  await expect(page.getByRole('menuitem', { name: 'Choose folder' })).toBeEnabled()
  await expect(page.getByRole('menuitem', { name: 'Choose PDF / EPUB files' })).toBeEnabled()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')
  await noOverflow(page)

  await page.getByRole('button', { name: 'Show library' }).click()
  await expect(page.getByRole('heading', { name: 'No documents selected yet' })).toBeVisible()
  await noOverflow(page)
})

test('keyboard entry, sidebar focus restoration, theme persistence and browser history work', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Go to app' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/app$/)

  const addDocuments = page.getByRole('button', { name: 'Add local documents' })
  await addDocuments.focus()
  await page.keyboard.press('Escape')
  const libraryToggle = page.getByRole('button', { name: 'Show library' })
  await expect(libraryToggle).toBeFocused()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary')).toBeVisible()

  const toggle = page.getByRole('button', { name: 'Dark mode' })
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('link', { name: 'PaperTrail home' }).click()
  await page.goBack()
  await expect(page).toHaveURL(/#\/app$/)
  await page.goForward()
  await expect(page.getByRole('link', { name: 'Go to app' })).toBeVisible()
})

test('browser library builds a tree, refreshes live handles and keeps file fallback flat', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let scan = 0
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        kind: 'directory',
        name: 'Mock library',
        async *entries() {
          scan += 1
          const version = scan

          yield [
            'guide.pdf',
            {
              kind: 'file',
              name: 'guide.pdf',
              getFile: async () =>
                new File([`pdf fixture ${version}`], 'guide.pdf', {
                  type: 'application/pdf',
                  lastModified: version,
                }),
            },
          ]

          yield [
            'Books',
            {
              kind: 'directory',
              name: 'Books',
              async *entries() {
                yield [
                  'book.epub',
                  {
                    kind: 'file',
                    name: 'book.epub',
                    getFile: async () =>
                      new File([`epub fixture ${version}`], 'book.epub', {
                        type: 'application/epub+zip',
                        lastModified: version,
                      }),
                  },
                ]
              },
            },
          ]
        },
      }),
    })
  })

  await page.goto('./#/app')
  const sourceStatus = page.locator('#library-source-status')
  const discoveryStatus = page.locator('#discovery-status')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await page.getByRole('button', { name: 'Add local documents' }).click()
  await page.getByRole('menuitem', { name: 'Choose folder' }).click()
  await expect(sourceStatus).toContainText('Folder “Mock library” selected')
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  await expect(localLibrary).toContainText('Mock library')
  await expect(
    localLibrary.locator('button[aria-expanded]').filter({ hasText: 'Books' }),
  ).toHaveAttribute('aria-expanded', 'true')

  let book = localLibrary.getByRole('button', { name: /book.epub/ })
  await book.click()
  await expect(book).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#reader-title')).toHaveText('book.epub')
  await expect(page.getByRole('alert')).toContainText('EPUB archive size is unsupported.')

  await page.getByRole('button', { name: 'Refresh folder' }).click()
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  book = localLibrary.getByRole('button', { name: /book.epub/ })
  await expect(book).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })
  })
  await page.getByRole('button', { name: 'Add local documents' }).click()
  await page.getByRole('menuitem', { name: 'Choose folder' }).click()
  await expect(sourceStatus).toContainText('cancelled or permission was not granted')

  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'guide.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('pdf fixture'),
    },
    {
      name: 'book.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from('epub fixture'),
    },
  ])

  await expect(sourceStatus).toContainText('2 items selected from the file picker')
  await expect(discoveryStatus).toContainText('2 supported documents found.')
  await expect(localLibrary).toContainText('Selected files')
  await expect(localLibrary.locator('button[aria-expanded]')).toHaveCount(0)
  await expect(localLibrary.getByRole('button', { name: /guide.pdf/ })).toBeVisible()
  await expect(localLibrary.getByRole('button', { name: /book.epub/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reselect files' })).toBeVisible()
  await expect(page.locator('#reader-title')).toHaveText('Welcome to PaperTrail')
})

test('PDF reader renders local pages, text layer, navigation and malformed-file recovery', async ({
  page,
}) => {
  await page.goto('./#/app')
  const fileInput = page.locator('input[accept*=".pdf"]')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await fileInput.setInputFiles({
    name: 'reader.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  await expect(localLibrary.getByRole('button', { name: /reader\.pdf/ })).toBeVisible()
  await localLibrary.getByRole('button', { name: /reader\.pdf/ }).click()

  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.locator('#reader-title')).toHaveText('reader.pdf')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 1').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 1')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 1')).toContainText('First page')

  const nextPage = page.getByRole('button', { name: 'Next page' })
  await expect(nextPage).not.toHaveAttribute('title')
  await expect(page.getByLabel('PDF page progress')).toHaveCount(0)
  await nextPage.hover()
  await expect(nextPage.locator('.icon-tooltip')).toBeVisible()
  const buttonBox = await nextPage.boundingBox()
  const tooltipBox = await nextPage.locator('.icon-tooltip').boundingBox()
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height)
  await nextPage.focus()
  await expect(nextPage.locator('.icon-tooltip')).toBeVisible()
  await nextPage.click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()
  await page.getByLabel('Rendered PDF page 2').scrollIntoViewIfNeeded()
  await expect(page.getByLabel('Rendered PDF page 2')).toBeVisible()
  await expect(page.getByLabel('Selectable text for PDF page 2')).toContainText('Second page')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByRole('button', { name: 'Show library' }).click()
  await fileInput.setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a valid PDF'),
  })
  await localLibrary.getByRole('button', { name: /broken\.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByRole('alert')).toContainText('This file is not a valid or supported PDF.')
})

test('PDF search, keyboard utilities and fullscreen work on a real text PDF', async ({ page }) => {
  await page.goto('./#/app')
  const fileInput = page.locator('input[accept*=".pdf"]')
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')

  await fileInput.setInputFiles({
    name: 'searchable-document-name-that-is-much-longer-than-toolbar-space.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  const longName = 'searchable-document-name-that-is-much-longer-than-toolbar-space.pdf'
  await localLibrary.getByRole('button', { name: new RegExp(longName) }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const title = page.locator('#reader-title')
  await expect(title).toHaveText(longName)
  await expect(title).toHaveAttribute('title', longName)
  await expect(title).toHaveAttribute('aria-label', longName)
  await expect(title).toHaveCSS('text-overflow', 'ellipsis')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.keyboard.press('Control+f')
  const searchInput = page.getByRole('searchbox', { name: 'Search PDF text' })
  await expect(searchInput).toBeFocused()
  await searchInput.fill('Second')
  const searchPanel = page.locator('[aria-label="PDF search results panel"]')
  await searchPanel.getByRole('search').getByRole('button', { name: 'Search' }).click()
  const resultsPanel = page.locator('[aria-label="PDF search results panel"]')
  await expect(resultsPanel.getByRole('status')).toContainText('1 match across searchable text.')
  await expect(searchPanel.getByRole('searchbox')).toBeVisible()
  await expect(resultsPanel.getByRole('button', { name: /Page 2.*Second page/ })).toBeVisible()
  await resultsPanel.getByRole('button', { name: /Page 2.*Second page/ }).click()
  await expect(page.getByText(/Page 2 of 2 ·/)).toBeVisible()

  await page.getByRole('button', { name: 'Search PDF' }).click()
  const reopenedSearchInput = page.getByRole('searchbox', { name: 'Search PDF text' })
  await expect(reopenedSearchInput).toBeFocused()
  await reopenedSearchInput.focus()
  await page.keyboard.type('c')
  await expect(page.getByRole('heading', { name: 'PDF contents' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.keyboard.press('?')
  await expect(page.getByRole('heading', { name: 'Keyboard help' })).toBeVisible()
  await page.getByRole('button', { name: 'Close keyboard help' }).click()

  await page.keyboard.press('c')
  await expect(page.getByRole('heading', { name: 'PDF contents' })).toBeVisible()
  await expect(page.getByText('This PDF does not provide an outline.')).toBeVisible()
  await page.getByRole('button', { name: 'Close utility panel' }).click()

  await page.setViewportSize({ width: 375, height: 800 })
  await page.getByRole('button', { name: 'Contents' }).click()
  const narrowContents = page.locator('[aria-label="PDF contents panel"]')
  await expect(narrowContents).toBeVisible()
  await expect(narrowContents).toHaveCSS('position', 'absolute')
  await page.getByRole('button', { name: 'Close utility panel' }).click()

  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText(/Page 1 of 2 ·/)).toBeVisible()

  await page.getByRole('button', { name: 'Enter fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible()
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)
})

test('app bounds and library/PDF scrolling stay independent at short heights', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 500 })
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const localLibrary = page.locator('section[aria-labelledby="local-library-title"]')
  const libraryList = page.getByRole('region', { name: 'Library documents', exact: true })
  const libraryHeader = await library.locator('header').boundingBox()
  await page.locator('input[accept*=".pdf"]').setInputFiles(
    Array.from({ length: 30 }, (_, i) => ({
      name: `document-${String(i).padStart(2, '0')}.pdf`,
      mimeType: 'application/pdf',
      buffer: createPdfFixture(),
    })),
  )
  await localLibrary.getByRole('button', { name: /document-00.pdf/ }).click()
  const pdf = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pdf).toBeVisible()
  await expect(page.getByTestId('recent-count')).toHaveText('1')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollHeight <= window.innerHeight &&
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  const bounds = await pdf.boundingBox()
  expect(bounds!.height).toBeGreaterThan(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500)
  await libraryList.focus()
  await page.keyboard.press('End')
  await expect
    .poll(() =>
      libraryList.evaluate((e) => Math.abs(e.scrollTop - (e.scrollHeight - e.clientHeight))),
    )
    .toBeLessThanOrEqual(1)
  await expect.poll(() => libraryList.evaluate((e) => e.scrollTop)).toBeGreaterThan(0)
  expect(await library.locator('header').boundingBox()).toEqual(libraryHeader)
  expect(await pdf.evaluate((e) => e.scrollTop)).toBe(0)
  const libraryPosition = await libraryList.evaluate((e) => e.scrollTop)
  if (page.viewportSize()!.width < 1024) {
    await library.press('Escape')
    await expect(page.getByRole('button', { name: 'Show library' })).toBeFocused()
  }
  await expect(page.getByLabel('Rendered PDF page 1', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByLabel('Rendered PDF page 1', { exact: true })
        .evaluate((e) => (e as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0)
  await pdf.focus()
  await page.keyboard.press('PageDown')
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('2')
  await expect.poll(() => pdf.evaluate((e) => e.scrollTop)).toBeGreaterThan(0)
  if (page.viewportSize()!.width >= 1024)
    expect(await libraryList.evaluate((e) => e.scrollTop)).toBe(libraryPosition)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('link', { name: 'PaperTrail home' }).click()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight))
    .toBe(true)
})

test('compact library menu dismisses independently and restores panel focus', async ({ page }) => {
  await page.goto('./#/app')
  const plus = page.getByRole('button', { name: 'Add local documents' })
  await expect(page.getByRole('button', { name: 'Show library' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh library' })).toBeDisabled()
  await plus.focus()
  await page.keyboard.press('Enter')
  const folder = page.getByRole('menuitem', { name: 'Choose folder' })
  await expect(folder).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Choose PDF / EPUB files' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(plus).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Document library' })).toBeVisible()
  await plus.click()
  await page.getByRole('link', { name: 'PaperTrail home' }).focus()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await plus.click()
  await page.locator('.app-header').click({ position: { x: 1, y: 1 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByRole('button', { name: 'Hide library' }).click()
  const opener = page.getByRole('button', { name: 'Show library' })
  await expect(opener).toBeFocused()
  await opener.press('Enter')
  await expect(opener).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide library' })).toBeFocused()
  await noOverflow(page)
})

test('library width resizes within bounds and top opener preserves title space', async ({
  page,
}) => {
  await page.goto('./#/app')
  const library = page.getByRole('complementary', { name: 'Document library' })
  const rail = page.getByRole('separator', { name: 'Resize library panel' })
  await expect
    .poll(async () => (await library.boundingBox())!.width)
    .toBe(Math.round(Math.min(308, page.viewportSize()!.width * 0.9)))
  await rail.hover()
  await expect(rail).toHaveCSS('cursor', 'col-resize')
  await rail.focus()
  await page.keyboard.press('ArrowLeft')
  const before = Number(await rail.getAttribute('aria-valuenow'))
  const bounds = (await rail.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 80)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + 80, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await rail.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
  await rail.focus()
  await page.keyboard.press('End')
  await expect
    .poll(async () => await rail.getAttribute('aria-valuenow'))
    .toBe(await rail.getAttribute('aria-valuemax'))
  await page.keyboard.press('Home')
  await expect
    .poll(async () => await rail.getAttribute('aria-valuenow'))
    .toBe(await rail.getAttribute('aria-valuemin'))
  await page.keyboard.press('ArrowRight')
  const remembered = await rail.getAttribute('aria-valuenow')
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(library).toHaveCount(0)
  const opener = page.getByRole('button', { name: 'Show library' })
  await expect(opener).toBeFocused()
  const openerBounds = (await opener.boundingBox())!
  const title = (await page.locator('#reader-title').boundingBox())!
  expect(openerBounds.y).toBeLessThanOrEqual(title.y)
  expect(openerBounds.x + openerBounds.width + 12).toBeLessThanOrEqual(title.x)
  await opener.click()
  await expect(rail).toHaveAttribute('aria-valuenow', remembered!)
  await noOverflow(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.reader-layout')).toHaveCSS('transition-duration', '0s')
})

test('PDF geometry and canvas stay stable after large scroll jumps and panel resize', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'scroll-regression.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(8),
  })
  await page.getByRole('button', { name: /scroll-regression.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  const shells = pane.locator('.pdf-page')
  await expect(pane.getByLabel('Rendered PDF page 1', { exact: true })).toBeVisible()
  const heights = await shells.evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().height),
  )
  // Native scrollbar drags change scrollTop in large increments; exercise that path directly.
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight - node.clientHeight
  })
  const last = pane.getByLabel('Rendered PDF page 8', { exact: true })
  await expect(last).toBeVisible()
  await expect(pane.getByLabel('Selectable text for PDF page 8', { exact: true })).toContainText(
    'Page 8',
  )
  await pane.evaluate((node) => {
    node.scrollTop = 0
  })
  const first = pane.getByLabel('Rendered PDF page 1', { exact: true })
  await expect(first).toBeVisible()
  await expect
    .poll(() => shells.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height)))
    .toEqual(heights)
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  const identity = await first.evaluate((node) => (node as HTMLCanvasElement).toDataURL())
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await expect(last).toBeVisible()
  await pane.evaluate((node) => {
    node.scrollTop = 0
  })
  await expect(first).toBeVisible()
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  expect(await first.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).toBe(identity)
  await page.getByRole('button', { name: 'Contents', exact: true }).click()
  await page.getByRole('button', { name: 'Close utility panel' }).click()
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await expect(last).toBeVisible()
  await expect
    .poll(() =>
      last.evaluate((node) =>
        Math.abs(
          node.getBoundingClientRect().width - node.parentElement!.getBoundingClientRect().width,
        ),
      ),
    )
    .toBeLessThan(2)
  await capture(page, info, 'pdf-scroll-jump-regression')
})

test('zoom and fit preserve the current reading point and zoom advances from fit', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'zoom-anchor.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(8),
  })
  await page.getByRole('button', { name: /zoom-anchor.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await page.getByLabel('Current page', { exact: true }).fill('4')
  await page.getByLabel('Current page', { exact: true }).press('Tab')
  const canvas = pane.getByLabel('Rendered PDF page 4', { exact: true })
  await expect(canvas).toBeVisible()
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('4')
  await expect(pane.locator('#pdf-page-4')).toHaveAttribute('data-render-state', 'ready')
  const readingPoint = () =>
    pane.evaluate((node) => {
      const box = node.querySelector('#pdf-page-4 .pdf-page')!.getBoundingClientRect()
      const viewport = node.getBoundingClientRect()
      return (viewport.top + node.clientHeight / 2 - box.top) / box.height
    })
  const point = await readingPoint()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(canvas).toBeVisible()
  await expect.poll(async () => Math.abs((await readingPoint()) - point)).toBeLessThan(0.025)
  for (const name of ['Fit page', 'Fit width']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(canvas).toBeVisible()
    await expect.poll(async () => Math.abs((await readingPoint()) - point)).toBeLessThan(0.025)
    const width = await canvas.evaluate((node) => node.getBoundingClientRect().width)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect
      .poll(() => canvas.evaluate((node) => node.getBoundingClientRect().width))
      .toBeGreaterThan(width)
    await expect.poll(async () => Math.abs((await readingPoint()) - point)).toBeLessThan(0.025)
  }
})

test('scrollbar jumps update the page field and navigation starts from the visible page', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'scroll-page-tracking.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(8),
  })
  await page.getByRole('button', { name: /scroll-page-tracking.pdf/ }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await pane.evaluate((node) => {
    const target = node.querySelector('#pdf-page-6')!
    node.scrollTop += target.getBoundingClientRect().top - node.getBoundingClientRect().top
  })
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('6')
  await expect(pane.getByLabel('Rendered PDF page 6', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('7')
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('6')
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('8')
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
})

test('a 1,001-page PDF opens without all-page rendering and supports a distant jump', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'chromium-1440',
    'Long-document regression runs once; navigation and zoom run at all five widths.',
  )
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'large-document.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(1001),
  })
  const started = Date.now()
  await page.getByRole('button', { name: /large-document.pdf/ }).click()
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  await info.attach('first-page-ready-ms', {
    body: String(Date.now() - started),
    contentType: 'text/plain',
  })
  expect(
    await pane
      .locator('canvas')
      .evaluateAll((nodes) => nodes.filter((n) => (n as HTMLCanvasElement).width > 0).length),
  ).toBeLessThan(10)
  await pane.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await expect(pane.locator('#pdf-page-1001')).toHaveAttribute('data-render-state', 'ready')
  await expect(page.getByLabel('Current page', { exact: true })).toHaveValue('1001')
  await expect(pane.getByLabel('Selectable text for PDF page 1001', { exact: true })).toContainText(
    'Page 1001',
  )
  await expect
    .poll(() =>
      pane
        .locator('canvas')
        .evaluateAll((nodes) => nodes.filter((n) => (n as HTMLCanvasElement).width > 0).length),
    )
    .toBeLessThan(10)
  await pane.evaluate((node) => {
    node.scrollTop = 0
  })
  await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
})

test('library labels use embedded title or filename and the opener tooltip stays onscreen', async ({
  page,
}) => {
  await page.goto('./#/app')
  const title =
    'A quiet chapter with a very long embedded PDF title that must stay on one line in the library'
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'metadata-file.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2, title) },
    { name: 'filename-fallback.pdf', mimeType: 'application/pdf', buffer: createPdfFixture() },
  ])
  const row = page.getByRole('button', { name: `PDF: ${title}`, exact: true })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('title', title)
  await expect(row).not.toContainText('metadata-file.pdf')
  await expect(
    page.getByRole('button', { name: 'PDF: filename-fallback.pdf', exact: true }),
  ).toBeVisible()
  expect(
    await row
      .locator('span')
      .last()
      .evaluate((node) => ({
        whiteSpace: getComputedStyle(node).whiteSpace,
        textOverflow: getComputedStyle(node).textOverflow,
      })),
  ).toEqual({ whiteSpace: 'nowrap', textOverflow: 'ellipsis' })
  await row.click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hide library' }).click()
  const opener = page.getByRole('button', { name: 'Show library' })
  await opener.hover()
  const tooltip = opener.locator('.icon-tooltip')
  await expect(tooltip).toBeVisible()
  const box = await tooltip.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  // Exercise real keyboard modality; programmatic focus after a click is not :focus-visible.
  await page.mouse.move(0, 0)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(opener).toBeFocused()
  await expect(tooltip).toBeVisible()
  const focusedBox = await tooltip.boundingBox()
  expect(focusedBox!.x).toBeGreaterThanOrEqual(0)
  expect(focusedBox!.x + focusedBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('library and document loaders are centered, responsive and respect reduced motion', async ({
  page,
}, info) => {
  let releaseWorker!: () => void
  const workerGate = new Promise<void>((resolve) => {
    releaseWorker = resolve
  })
  await page.context().route('**/pdf.worker*.mjs', async (route) => {
    await workerGate
    await route.continue()
  })
  await page.addInitScript(
    (bytes) => {
      let finishScan!: () => void
      const scanGate = new Promise<void>((resolve) => {
        finishScan = resolve
      })
      const file = new File([new Uint8Array(bytes)], 'loading-preview.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => ({
          kind: 'directory',
          name: 'Loading preview',
          async *entries() {
            await scanGate
            yield ['loading-preview.pdf', { kind: 'file', getFile: async () => file }]
          },
        }),
      })
      Object.assign(window, { finishLoadingScan: finishScan })
    },
    [...createPdfFixture()],
  )
  try {
    await page.goto('./#/app')
    const library = page.getByRole('region', { name: 'Library documents', exact: true })
    await page.getByRole('button', { name: 'Add local documents' }).click()
    await page.getByRole('menuitem', { name: 'Choose folder', exact: true }).click()
    await expect(library).toHaveAttribute('aria-busy', 'true')
    const libraryCard = library.locator('.loading-card')
    await expect(libraryCard).toBeVisible()
    await expect(library.getByRole('button', { name: 'Cancel scan' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Add local documents' })).toBeEnabled()
    await expect
      .poll(() =>
        libraryCard.evaluate((element) => {
          const area = element.closest('.library-list')!.getBoundingClientRect()
          const card = element.getBoundingClientRect()
          return Math.abs(card.y + card.height / 2 - area.y - area.height / 2)
        }),
      )
      .toBeLessThan(3)
    await expect(library.locator('.loading-view')).toHaveCSS('opacity', '1')
    await capture(page, info, 'library-centered-loading')
    await expect(libraryCard).toContainText('Thanks for your patience')
    await page.evaluate(() =>
      (window as unknown as { finishLoadingScan: () => void }).finishLoadingScan(),
    )
    await expect(library).toHaveAttribute('aria-busy', 'false')
    await library.getByRole('button', { name: 'PDF: loading-preview.pdf', exact: true }).click()
    const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
    const pdfCard = pane.locator('.loading-card')
    await expect(pdfCard).toBeVisible()
    await expect(pdfCard).toContainText('Opening document')
    await expect
      .poll(() =>
        pdfCard.evaluate((element) => {
          const area = element.closest('.pdf-scroll')!.getBoundingClientRect()
          const card = element.getBoundingClientRect()
          return Math.abs(card.y + card.height / 2 - area.y - area.height / 2)
        }),
      )
      .toBeLessThan(3)
    if (page.viewportSize()!.width < 1024) {
      await page.getByRole('button', { name: 'Hide library' }).click()
      await expect(page.getByRole('complementary', { name: 'Document library' })).not.toBeVisible()
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(pdfCard.locator('.loading-orbit')).toHaveCSS('animation-name', 'none')
    await expect(pane.locator('.loading-view')).toHaveCSS('opacity', '1')
    await capture(page, info, 'pdf-centered-opening')
    releaseWorker()
    await expect(pane.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
    await expect(pane).toHaveAttribute('aria-busy', 'false')
    await noOverflow(page)
  } finally {
    releaseWorker()
  }
})

test('reader polish keeps tabs distinct, focus clear and motion accessible in both themes', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'reader-polish.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(),
  })
  await page.getByRole('button', { name: 'PDF: reader-polish.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByLabel('Current page')).toHaveValue('1')
  await expect(page.locator('.app-header').getByText('Appearance', { exact: true })).toHaveCount(0)

  const input = page.getByLabel('Current page')
  const next = page.getByRole('button', { name: 'Next page', exact: true })
  await next.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(input).toBeFocused()
  const inputBox = (await input.boundingBox())!
  const nextBox = (await next.boundingBox())!
  const previousBox = (await page
    .getByRole('button', { name: 'Previous page', exact: true })
    .boundingBox())!
  const clearance = await input.evaluate((element) => {
    const style = getComputedStyle(element)
    return parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
  })
  // Wrapping onto different rows is allowed; surfaces must clear the input's focus outline.
  for (const box of [previousBox, nextBox]) {
    expect(
      box.x + box.width <= inputBox.x - clearance ||
        box.x >= inputBox.x + inputBox.width + clearance ||
        box.y + box.height <= inputBox.y - clearance ||
        box.y >= inputBox.y + inputBox.height + clearance,
    ).toBe(true)
  }

  const contents = page.getByRole('button', { name: 'Contents', exact: true }).first()
  for (const theme of ['light', 'dark']) {
    const toggle = page.getByRole('button', { name: 'Dark mode' })
    if ((await toggle.getAttribute('aria-pressed')) !== String(theme === 'dark'))
      await toggle.click()
    await contents.click()
    const panel = page.locator('.pdf-side-panel')
    await expect(panel).toHaveCSS('opacity', '1')
    await expect(panel.getByRole('heading', { name: 'Contents', exact: true })).toBeVisible()
    await expect(panel.locator('.utility-tab')).toHaveCount(0)
    await expect(contents).toHaveAttribute('aria-pressed', 'true')
    const searchControl = page.getByRole('button', { name: 'Search PDF', exact: true })
    await searchControl.click()
    await expect(searchControl).toHaveAttribute('aria-pressed', 'true')
    await expect(contents).toHaveAttribute('aria-pressed', 'false')
    await expect(panel.getByRole('heading', { name: 'Search', exact: true })).toBeVisible()
    await capture(page, info, `reader-polish-${theme}`)
    await page.keyboard.press('Escape')
    await expect(searchControl).toBeFocused()
    await expect(page.locator('.pdf-side-panel')).toHaveCount(0)
    await noOverflow(page)
  }

  // Sample immediately after state changes, without timing-sensitive sleeps.
  const motion = await contents.evaluate(async (button) => {
    ;(button as HTMLButtonElement).click()
    await Promise.resolve()
    const panel = document.querySelector<HTMLElement>('.pdf-side-panel')!
    const entering = panel.classList.contains('utility-panel-enter-active')
    const duration = getComputedStyle(panel).transitionDuration
    panel.querySelector<HTMLButtonElement>('[aria-label="Close utility panel"]')!.click()
    await Promise.resolve()
    return {
      entering,
      duration,
      leaving: panel.classList.contains('utility-panel-leave-active'),
      inert: panel.inert,
      hidden: panel.getAttribute('aria-hidden'),
    }
  })
  expect(motion).toEqual({
    entering: true,
    duration: '0.32s, 0.32s',
    leaving: true,
    inert: true,
    hidden: 'true',
  })
  await expect(page.locator('.pdf-side-panel')).toHaveCount(0)

  const search = page.getByRole('button', { name: 'Search PDF', exact: true })
  const popoverDuration = await search.evaluate(async (button) => {
    ;(button as HTMLButtonElement).click()
    await Promise.resolve()
    return getComputedStyle(document.querySelector('.pdf-side-panel')!).transitionDuration
  })
  expect(popoverDuration).toBe('0.32s, 0.32s')
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toBeFocused()
  await expect(page.getByRole('searchbox')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await contents.click()
  await expect(page.locator('.pdf-side-panel')).toHaveCSS('transition-duration', '0s')
  await page.getByRole('button', { name: 'Close utility panel' }).click()
  await expect(contents).toBeFocused()
  await search.click()
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toBeFocused()
  await page.getByRole('button', { name: 'Show library' }).click()
  await expect(page.getByRole('button', { name: 'Hide library' })).toBeFocused()
  const add = page.getByRole('button', { name: 'Add local documents' })
  await add.click()
  await expect(page.getByRole('menuitem', { name: 'Choose folder', exact: true })).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCSS('transition-duration', '0s')
  await page.keyboard.press('Escape')
  await expect(add).toBeFocused()

  await page.setViewportSize({ width: page.viewportSize()!.width, height: 500 })
  const footer = page.getByRole('contentinfo', { name: 'Deployment information' })
  await expect(footer).toHaveCSS('padding-top', '2px')
  await expect(footer).toHaveCSS(
    'background-color',
    await page.locator('.app-header').evaluate((el) => getComputedStyle(el).backgroundColor),
  )
  // The CI build has no deployment metadata. Stress its real footer CSS with representative
  // preview links and a long branch token; component tests verify the actual metadata template.
  await footer.evaluate((element) => {
    const nodes = [
      'Preview · PR #98',
      'Branch fix/reader-polish-with-a-very-long-branch-name-that-wraps-on-a-small-screen',
      'SHA f44d675',
    ].map((text, index) => {
      const span = document.createElement('span')
      const link = document.createElement('a')
      // Match Vue's compiled scoped markup so the real component's link rules apply.
      for (const attribute of element
        .getAttributeNames()
        .filter((name) => name.startsWith('data-v-'))) {
        span.setAttribute(attribute, '')
        link.setAttribute(attribute, '')
      }
      link.textContent = text
      link.href =
        index === 0
          ? 'https://github.com/HimanshuHD/papertrail-reader/pull/98'
          : index === 1
            ? 'https://github.com/HimanshuHD/papertrail-reader/tree/fix/reader-polish'
            : 'https://github.com/HimanshuHD/papertrail-reader/commit/f44d67517ba17053d15e4b420372526a5002a10c'
      span.append(link)
      return span
    })
    element.replaceChildren(...nodes)
  })
  for (const link of await footer.getByRole('link').all()) {
    const box = (await link.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(box.height).toBeGreaterThanOrEqual(24)
    await link.focus()
    await expect(link).toBeFocused()
  }
  await noOverflow(page)
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true)
  await capture(page, info, 'reader-polish-short-height')
})

test('search excerpts wrap and selected PDF occurrences stay aligned after zoom and fit', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'search-occurrences.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(2, undefined, true),
  })
  await page.getByRole('button', { name: 'PDF: search-occurrences.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.getByLabel('Current page')).toHaveValue('1')
  await page.getByRole('button', { name: 'Search PDF', exact: true }).click()
  await page.getByRole('searchbox').fill('NEEDLE')
  await page.getByRole('search').getByRole('button', { name: 'Search', exact: true }).click()
  const panel = page.locator('[aria-label="PDF search results panel"]')
  await expect(panel.getByRole('status')).toContainText('2 matches')
  await expect(panel.locator('mark')).toHaveCount(2)
  await expect(panel.locator('mark').first()).toHaveText('Needle')
  await expect(panel.locator('mark').last()).toHaveText('needle')
  const firstExcerpt = await panel.locator('.search-excerpt').first().textContent()
  expect(firstExcerpt!.startsWith('…')).toBe(true)
  expect(Array.from(firstExcerpt!.slice(1).split('Needle')[0]!)).toHaveLength(50)
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await panel.getByRole('button', { name: /Page 2 · Match 2/ }).click()
  await expect(page.getByLabel('Current page')).toHaveValue('2')
  const highlight = page.locator('#pdf-page-2 .pdf-match.selected[data-occurrence="2"]')
  await expect(highlight).toHaveCount(1)
  async function alignedAndVisible(requireVisible = true) {
    await expect
      .poll(() =>
        highlight.evaluate((el) => {
          const span = [...document.querySelectorAll('#pdf-page-2 .textLayer span')].find(
            (s) => s.textContent === 'needle',
          )!
          const range = document.createRange()
          range.selectNodeContents(span)
          const text = range.getBoundingClientRect(),
            box = el.getBoundingClientRect()
          return Math.max(
            Math.abs(text.left - box.left),
            Math.abs(text.top - box.top),
            Math.abs(text.width - box.width),
            Math.abs(text.height - box.height),
          )
        }),
      )
      .toBeLessThan(2)
    // Check painted canvas ink independently of the selectable DOM text.
    // The fixture's second "needle" starts at PDF coordinates (72, 160).
    await expect
      .poll(() =>
        highlight.evaluate((el) => {
          const canvas = document.querySelector<HTMLCanvasElement>('#pdf-page-2 canvas')!
          const bounds = canvas.getBoundingClientRect(),
            box = el.getBoundingClientRect()
          const scale = bounds.width / 612
          const left = Math.floor((72 * canvas.width) / 612)
          const top = Math.floor(((792 - 165) * canvas.height) / 792)
          const width = Math.max(1, Math.ceil((18 * canvas.width) / 612))
          const height = Math.max(1, Math.ceil((6 * canvas.height) / 792))
          const pixels = canvas.getContext('2d')!.getImageData(left, top, width, height).data
          let ink = 0
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i]! < 200 && pixels[i + 1]! < 200 && pixels[i + 2]! < 200) ink++
          }
          return (
            ink > 0 &&
            Math.abs(box.left - bounds.left - 72 * scale) < 2 &&
            box.top <= bounds.top + (792 - 160) * scale &&
            box.bottom >= bounds.top + (792 - 164) * scale
          )
        }),
      )
      .toBe(true)
    if (requireVisible) {
      const h = (await highlight.boundingBox())!,
        pane = (await page.locator('.pdf-scroll').boundingBox())!
      expect(h.y).toBeGreaterThanOrEqual(pane.y - 1)
      expect(h.y + h.height).toBeLessThanOrEqual(pane.y + pane.height + 1)
    }
  }
  await alignedAndVisible()
  await capture(page, info, 'selected-search-occurrence')
  for (const button of ['Zoom in', 'Fit page', 'Fit width']) {
    await page.getByRole('button', { name: button, exact: true }).click()
    await expect(page.locator('#pdf-page-2')).toHaveAttribute('data-render-state', 'ready')
    // Fit/zoom retains the existing reading point, not a sticky search target.
    await alignedAndVisible(false)
  }
  await page.locator('.pdf-scroll').evaluate((el) => {
    el.scrollTop -= 40
  })
  await alignedAndVisible(false)
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(panel.locator('mark').first()).toHaveCSS('color', 'rgb(66, 32, 6)')
  await page.getByRole('button', { name: 'Search PDF', exact: true }).click()
  await page.getByRole('searchbox').fill('wrapped match')
  await expect(page.locator('.pdf-match')).toHaveCount(0)
  await page.getByRole('search').getByRole('button', { name: 'Search', exact: true }).click()
  await expect(panel.locator('mark')).toHaveText('wrapped match')
  await panel.getByRole('button', { name: /Page 2 · Match 1/ }).click()
  await expect(page.locator('#pdf-page-2 .pdf-match.selected').first()).toBeVisible()
  await expect
    .poll(() => page.locator('#pdf-page-2 .pdf-match.selected').count())
    .toBeGreaterThanOrEqual(2)
  await expect(panel.getByRole('searchbox')).toHaveValue('wrapped match')
  await expect(panel.getByRole('button', { name: /Page 2 · Match 1/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await capture(page, info, 'wrapped-search-occurrence-dark')
  await noOverflow(page)
})

test('PDF reading positions survive reload and rename without matching changed content', async ({
  page,
}) => {
  await page.goto('./#/app')
  const bytes = createPdfFixture(4)
  const select = async (name: string, buffer: Buffer) => {
    const opener = page.getByRole('button', { name: 'Show library' })
    if (await opener.isVisible()) await opener.click()
    await page
      .locator('input[accept*=".pdf"]')
      .setInputFiles({ name, mimeType: 'application/pdf', buffer })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: new RegExp('^PDF: ' + name.replaceAll('.', '\\.') + '$') })
      .click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('button', { name: 'Hide library' }).click()
  }
  const savedPage = () =>
    page.evaluate(async () => {
      if (!(await indexedDB.databases()).some((database) => database.name === 'papertrail-reading'))
        return null
      return new Promise<number | null>((resolve, reject) => {
        const request = indexedDB.open('papertrail-reading')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('documents')) {
            db.close()
            resolve(null)
            return
          }
          const transaction = db.transaction('documents')
          const records = transaction.objectStore('documents').getAll()
          records.onsuccess = () => resolve(records.result[0]?.page ?? null)
          transaction.oncomplete = () => db.close()
        }
      })
    })
  await select('original.pdf', bytes)
  await expect.poll(savedPage).toBe(1)
  const input = page.getByRole('spinbutton', { name: 'Current page' })
  await input.fill('3')
  await input.press('Tab')
  await expect.poll(savedPage).toBe(3)
  await page.getByRole('button', { name: 'Zoom in' }).click()
  const readView = () =>
    page.evaluate(
      async () =>
        new Promise<{ fitMode: string; zoom: number } | null>((resolve, reject) => {
          const request = indexedDB.open('papertrail-reading')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction('documents')
            const records = transaction.objectStore('documents').getAll()
            records.onsuccess = () => resolve(records.result[0]?.view ?? null)
            transaction.oncomplete = () => db.close()
          }
        }),
    )
  await expect.poll(async () => (await readView())?.fitMode).toBe('custom')
  const savedView = (await readView())!
  await page.reload()
  // Delay identity resolution to make any first-page flash observable.
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = async (...args: Parameters<SubtleCrypto['digest']>) => {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return digest(...args)
    }
    const observed: string[] = []
    ;(window as unknown as { restoredFrames: string[] }).restoredFrames = observed
    const sample = () => {
      const pane = document.querySelector('[aria-label="PDF pages"]')
      if (pane?.getAttribute('aria-busy') === 'false') {
        const input = document.querySelector<HTMLInputElement>('[aria-label="Current page"]')
        if (input) observed.push(input.value)
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await select('renamed.pdf', bytes)
  await expect(input).toHaveValue('3')
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  await expect(
    page.getByText(new RegExp(`Page 3 of 4 ·.*${Math.round(savedView.zoom * 100)}%`)),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { restoredFrames: string[] }).restoredFrames.length,
      ),
    )
    .toBeGreaterThan(0)
  expect(
    await page.evaluate(() =>
      (window as unknown as { restoredFrames: string[] }).restoredFrames.every(
        (value) => value === '3',
      ),
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Fit page', exact: true }).click()
  await expect.poll(async () => (await readView())?.fitMode).toBe('page')
  await page.reload()
  await select('renamed.pdf', bytes)
  await expect(input).toHaveValue('3')
  await expect(page.getByRole('button', { name: 'Fit page', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await select('renamed.pdf', createPdfFixture(2))
  await expect(input).toHaveValue('1')
})

async function readSavedWorkspace(page: Page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((db) => db.name === 'papertrail-workspace')) return null
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const open = indexedDB.open('papertrail-workspace')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const transaction = db.transaction('workspace')
        const request = transaction.objectStore('workspace').get('current')
        request.onsuccess = () => {
          const state = request.result
          // Keep the native capability inside the browser; transport plain evidence only.
          resolve(
            state
              ? {
                  ...state,
                  handle: state.handle
                    ? { kind: state.handle.kind, name: state.handle.name }
                    : null,
                }
              : null,
          )
        }
        transaction.oncomplete = () => db.close()
      }
    })
  })
}

test('cached workspace preserves tree, selection and panel context without retaining PDF bytes', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await page.evaluate(async () => {
    const documents = Array.from({ length: 35 }, (_, i) => ({
      id: `saved-${i}`,
      name: `book-${i}.pdf`,
      format: 'PDF',
      relativePath: `Books/book-${i}.pdf`,
      parentPath: 'Books',
      source: 'directory-input',
      size: 100,
      lastModified: 1,
    }))
    documents.push({
      ...documents[0]!,
      id: 'reference',
      relativePath: 'Reference/book.pdf',
      parentPath: 'Reference',
      name: 'book.pdf',
    })
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('papertrail-workspace', 1)
      open.onupgradeneeded = () => open.result.createObjectStore('workspace')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const transaction = db.transaction('workspace', 'readwrite')
        transaction.objectStore('workspace').put(
          {
            version: 1,
            source: 'directory-input',
            label: 'Remembered books',
            handle: null,
            documents,
            selectedPath: 'Books/book-20.pdf',
            activePath: 'Books/book-20.pdf',
            activeFingerprint: 'old',
            collapsedPaths: ['Reference'],
            libraryScroll: 250,
            sidebarOpen: false,
            sidebarWidth: 380,
          },
          'current',
        )
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show library' })).toBeVisible()
  await expect(page.locator('#reader-title')).toHaveText('book-20.pdf')
  await page.getByRole('button', { name: 'Show library' }).click()
  const library = page.getByRole('region', { name: 'Library documents', exact: true })
  await expect(
    library.locator('button[aria-expanded]').filter({ hasText: 'Reference' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await expect(
    library.getByRole('button', { name: 'PDF: book-20.pdf', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    library.getByRole('button', { name: 'PDF: book-20.pdf', exact: true }),
  ).toBeDisabled()
  await expect.poll(() => library.evaluate((element) => element.scrollTop)).toBe(250)
  if (page.viewportSize()!.width >= 1024)
    await expect(page.getByRole('separator', { name: 'Resize library panel' })).toHaveAttribute(
      'aria-valuenow',
      '380',
    )
  const stored = await readSavedWorkspace(page)
  expect((stored!.documents as Record<string, unknown>[]).every((item) => !('file' in item))).toBe(
    true,
  )
  await capture(page, info, 'workspace-reselection')
  await page.getByRole('button', { name: 'Forget library', exact: true }).click()
  await expect.poll(() => readSavedWorkspace(page)).toBeNull()
  await page.reload()
  await expect(page.getByText('No documents selected yet', { exact: true })).toBeVisible()
})

test('native persisted directory reopens the PDF at its anchor and rejects changed content', async ({
  playwright,
}, info) => {
  test.skip(
    info.project.name !== 'chromium-1440',
    'Native handle lifecycle is covered once; cached UI is covered at all viewport widths.',
  )
  // Native handle persistence uses a normal profile, not an incognito context.
  // An empty userDataDir asks Playwright for an isolated temporary profile.
  const context = await playwright.chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: info.project.use.viewport,
    baseURL: info.project.use.baseURL,
  })
  const page = context.pages()[0] ?? (await context.newPage())
  try {
    await page.goto('./#/app')
    await page.evaluate(
      async (bytes) => {
        const root = await navigator.storage.getDirectory()
        const directory = await root.getDirectoryHandle('remembered-books', { create: true })
        const file = await directory.getFileHandle('book.pdf', { create: true })
        const writer = await file.createWritable()
        await writer.write(new Uint8Array(bytes))
        await writer.close()
        Object.defineProperty(window, 'showDirectoryPicker', {
          configurable: true,
          value: async () => directory,
        })
      },
      [...createPdfFixture(8)],
    )
    await page.getByRole('button', { name: 'Add local documents' }).click()
    await page.getByRole('menuitem', { name: 'Choose folder', exact: true }).click()
    await page.getByRole('button', { name: 'PDF: book.pdf', exact: true }).click()
    const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
    await expect(pane).toHaveAttribute('aria-busy', 'false')
    await expect.poll(async () => (await readSavedWorkspace(page))?.activeFingerprint).toBeTruthy()
    await page.getByRole('button', { name: 'PDF: book.pdf', exact: true }).click()
    await expect.poll(async () => (await readSavedWorkspace(page))?.activeFingerprint).toBeTruthy()
    await page.getByRole('button', { name: 'Hide library' }).click()
    const input = page.getByRole('spinbutton', { name: 'Current page' })
    await input.fill('3')
    await input.press('Tab')
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await pane.evaluate((element) => {
      element.scrollTop += 180
    })
    const reading = () =>
      page.evaluate(
        async () =>
          new Promise<{
            anchor: { page: number; x: number; y: number }
            view: { fitMode: string; zoom: number }
          }>((resolve, reject) => {
            const open = indexedDB.open('papertrail-reading')
            open.onerror = () => reject(open.error)
            open.onsuccess = () => {
              const db = open.result
              const transaction = db.transaction('documents')
              const records = transaction.objectStore('documents').getAll()
              records.onsuccess = () => resolve(records.result[0])
              transaction.oncomplete = () => db.close()
            }
          }),
      )
    await expect.poll(async () => (await reading()).anchor?.page).toBeGreaterThanOrEqual(3)
    await expect.poll(async () => (await readSavedWorkspace(page))?.activeFingerprint).toBeTruthy()
    await page.getByRole('button', { name: 'Contents', exact: true }).click()
    await expect(page.getByRole('complementary', { name: 'PDF contents panel' })).toBeVisible()
    await expect.poll(async () => (await readSavedWorkspace(page))?.utilityPanel).toBe('contents')
    const before = await reading()
    await page.reload()
    await expect(pane).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('button', { name: 'Show library' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'PDF contents panel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
    await expect.poll(async () => (await reading()).view.zoom).toBe(before.view.zoom)
    await expect
      .poll(async () => Math.abs((await reading()).anchor.y - before.anchor.y))
      .toBeLessThan(0.025)
    await expect.poll(async () => (await reading()).anchor.page).toBe(before.anchor.page)
    const restoredY = await pane.evaluate((element, anchor) => {
      const pdf = element.querySelector(`#pdf-page-${anchor.page} .pdf-page`)!
      const box = pdf.getBoundingClientRect()
      return (element.getBoundingClientRect().top + element.clientHeight / 2 - box.top) / box.height
    }, before.anchor)
    expect(Math.abs(restoredY - before.anchor.y)).toBeLessThan(0.025)
    await capture(page, info, 'workspace-native-restored')
    await page.evaluate(
      async (bytes) => {
        const root = await navigator.storage.getDirectory()
        const directory = await root.getDirectoryHandle('remembered-books')
        const file = await directory.getFileHandle('book.pdf')
        const writer = await file.createWritable()
        await writer.write(new Uint8Array(bytes))
        await writer.close()
      },
      [...createPdfFixture(2)],
    )
    await page.reload()
    await page.getByRole('button', { name: 'Show library' }).click()
    await expect(
      page.getByText(
        'The previously opened document changed or is unavailable. Select a document to continue.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(pane).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'PDF: book.pdf', exact: true })).toBeEnabled()
  } finally {
    await context.close()
  }
})

test('PDF bookmarks retain named anchors across reload and rename and isolate changed files', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  const bytes = createPdfFixture(6)
  const select = async (name: string, buffer: Buffer) => {
    const opener = page.getByRole('button', { name: 'Show library' })
    if (await opener.isVisible()) await opener.click()
    await page
      .locator('input[accept*=".pdf"]')
      .setInputFiles({ name, mimeType: 'application/pdf', buffer })
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `PDF: ${name}`, exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    await page.getByRole('button', { name: 'Hide library' }).click()
  }
  const panel = page.getByRole('complementary', { name: 'PDF bookmarks panel', exact: true })
  const openBookmarks = async () => {
    if (!(await panel.isVisible())) await page.locator('button[aria-label="Bookmarks"]').click()
    await expect(
      panel.getByRole('button', { name: 'Save current place', exact: true }),
    ).toBeEnabled()
  }
  const records = () =>
    page.evaluate(
      async () =>
        new Promise<Record<string, unknown>[]>((resolve, reject) => {
          const open = indexedDB.open('papertrail-reading')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const db = open.result
            const transaction = db.transaction('documents')
            const request = transaction.objectStore('documents').getAll()
            request.onsuccess = () => resolve(request.result)
            transaction.oncomplete = () => db.close()
          }
        }),
    )
  await select('bookmarked.pdf', bytes)
  const pane = page.getByRole('region', { name: 'PDF pages', exact: true })
  const input = page.getByRole('spinbutton', { name: 'Current page' })
  await input.fill('3')
  await input.press('Tab')
  await pane.evaluate((element) => {
    element.scrollTop += 90
  })
  await openBookmarks()
  await panel.getByLabel('Bookmark name', { exact: true }).fill('The important part')
  await panel.getByRole('button', { name: 'Save current place', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: 'Go to bookmark The important part', exact: true }),
  ).toBeVisible()
  const saved = (await records())[0]!
  const bookmark = (saved.bookmarks as { anchor: { page: number; x: number; y: number } }[])[0]!
  expect(bookmark.anchor.page).toBeGreaterThanOrEqual(3)
  await panel.getByRole('button', { name: 'Close utility panel' }).click()
  await input.fill('1')
  await input.press('Tab')
  await openBookmarks()
  await panel
    .getByRole('button', { name: 'Go to bookmark The important part', exact: true })
    .click()
  await expect(panel).toHaveCount(0)
  await expect
    .poll(() =>
      pane.evaluate((element, anchor) => {
        const box = element
          .querySelector(`#pdf-page-${anchor.page} .pdf-page`)!
          .getBoundingClientRect()
        return Math.abs(
          (element.getBoundingClientRect().top + element.clientHeight / 2 - box.top) / box.height -
            anchor.y,
        )
      }, bookmark.anchor),
    )
    .toBeLessThan(0.035)
  await openBookmarks()
  await panel
    .getByRole('button', { name: 'Rename bookmark The important part', exact: true })
    .click()
  await panel.getByLabel('New bookmark name', { exact: true }).fill('Revisit this chapter')
  await panel.getByRole('button', { name: 'Save name', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: 'Go to bookmark Revisit this chapter', exact: true }),
  ).toBeVisible()
  await expect.poll(async () => (await readSavedWorkspace(page))?.utilityPanel).toBe('bookmarks')
  await noOverflow(page)
  await capture(page, info, 'pdf-bookmarks')
  await page.reload()
  await select('renamed.pdf', bytes)
  await openBookmarks()
  await expect(
    panel.getByRole('button', { name: 'Go to bookmark Revisit this chapter', exact: true }),
  ).toBeVisible()
  expect((await records())[0]!.id).toBe(saved.id)
  await panel.getByRole('button', { name: 'Close utility panel' }).click()
  await select('renamed.pdf', createPdfFixture(2))
  await openBookmarks()
  await expect(
    panel.getByText('No bookmarks yet. Save your current place to begin.', { exact: true }),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Close utility panel' }).click()
  await select('original-again.pdf', bytes)
  await openBookmarks()
  await expect(
    panel.getByRole('button', { name: 'Go to bookmark Revisit this chapter', exact: true }),
  ).toBeVisible()
  await panel
    .getByRole('button', { name: 'Remove bookmark Revisit this chapter', exact: true })
    .click()
  await expect(
    panel.getByText('No bookmarks yet. Save your current place to begin.', { exact: true }),
  ).toBeVisible()
  await expect(panel.getByLabel('Bookmark name', { exact: true })).toBeFocused()
  if (info.project.name === 'chromium-1440') {
    await page.evaluate(
      async () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('papertrail-reading')
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        }),
    )
    await panel.getByLabel('Bookmark name', { exact: true }).fill('Keep this draft')
    await panel.getByRole('button', { name: 'Save current place', exact: true }).click()
    await expect(panel.getByRole('status')).toContainText('could not be saved')
    await expect(panel.getByLabel('Bookmark name', { exact: true })).toHaveValue('Keep this draft')
    expect(await records()).toEqual([])
  }
})

test('library filtering and recent PDF recovery preserve document metadata', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('./#/app')
  const bytes = createPdfFixture(3, 'Recent guide')
  const show = async () => {
    const opener = page.getByRole('button', { name: 'Show library' })
    if (await opener.isVisible()) await opener.click()
  }
  const library = page.getByRole('region', { name: 'Library documents', exact: true })
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    { name: 'guide.pdf', mimeType: 'application/pdf', buffer: bytes },
    { name: 'other.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) },
  ])
  await library.getByRole('button', { name: 'PDF: Recent guide', exact: true }).click()
  await library.getByRole('button', { name: /^Recent\s*1$/ }).click()
  await expect(
    library.getByRole('button', { name: 'Open recent PDF guide.pdf', exact: true }),
  ).toBeEnabled()
  await page.getByLabel('Search library', { exact: true }).fill('other')
  await expect(page.getByRole('status').filter({ hasText: '1 matching documents' })).toBeVisible()
  await expect(library.getByRole('button', { name: 'PDF: Recent guide', exact: true })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Clear library search' }).click()
  const recentToggle = library.getByRole('button', { name: /^Recent\s*1$/ })
  await recentToggle.click()
  await expect(recentToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(
    library.getByRole('button', { name: 'Open recent PDF guide.pdf', exact: true }),
  ).toBeHidden()
  await recentToggle.focus()
  await page.keyboard.press('Enter')
  await expect(recentToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByPlaceholder('Search documents...', { exact: true })).toBeVisible()
  await noOverflow(page)
  const searchBox = await page.getByLabel('Search library', { exact: true }).boundingBox()
  const headerBox = await page.locator('.library-panel > header').boundingBox()
  const recentBox = await recentToggle.boundingBox()
  expect(
    searchBox &&
      headerBox &&
      recentBox &&
      searchBox.y >= headerBox.y + headerBox.height &&
      searchBox.y < recentBox.y,
  ).toBeTruthy()
  await expect(page.getByText('PDFs you open will appear here.', { exact: true })).toHaveCount(0)
  await expect(
    page.getByText(
      'Filters library filenames, titles and paths. Search inside a PDF from its reader toolbar.',
      { exact: true },
    ),
  ).toHaveCount(0)
  await capture(page, info, 'recent-library')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await capture(page, info, 'recent-library-dark')
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.reload()
  await show()
  await library.getByRole('button', { name: /^Recent\s*1$/ }).click()
  await library.getByRole('button', { name: 'Open recent PDF guide.pdf', exact: true }).click()
  await expect(
    library.getByRole('status').filter({ hasText: 'unavailable or changed' }),
  ).toBeVisible()
  await page
    .locator('input[accept*=".pdf"]')
    .setInputFiles({ name: 'renamed.pdf', mimeType: 'application/pdf', buffer: bytes })
  await library.getByRole('button', { name: 'PDF: Recent guide', exact: true }).waitFor()
  await library.getByRole('button', { name: 'Open recent PDF guide.pdf', exact: true }).click()
  await expect(page.getByRole('region', { name: 'PDF pages', exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(
    library.getByRole('button', { name: 'Open recent PDF renamed.pdf', exact: true }),
  ).toBeEnabled()
  await library.getByRole('button', { name: 'Clear recent history' }).click()
  await expect(library.getByTestId('recent-count')).toHaveText('0')
  await expect(library.getByRole('button', { name: /^Open recent PDF/ })).toHaveCount(0)
  const readingCount = await page.evaluate(
    async () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('papertrail-reading', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('documents')
          const count = transaction.objectStore('documents').count()
          count.onsuccess = () => resolve(count.result)
          transaction.oncomplete = () => db.close()
        }
      }),
  )
  expect(readingCount).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('EPUB highlights persist across view changes, reload and local edits', async ({
  page,
}, info) => {
  const book = {
    name: 'highlight.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(
      createEpubFixture({
        chapter:
          '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p id="highlight-text">Persistent <em>EPUB</em> selection.</p></body></html>',
      }),
    ),
  }
  const open = async () => {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page.locator('input[accept*=".pdf"]').setInputFiles(book)
    await page
      .locator('section[aria-labelledby="local-library-title"]')
      .getByRole('button', { name: /highlight.epub/ })
      .click()
    const hide = page.getByRole('button', { name: 'Hide library' })
    if (await hide.isVisible()) await hide.click()
  }
  await page.goto('./#/app')
  await open()
  const reader = page.getByRole('region', { name: 'EPUB reader' })
  const paragraph = reader.frameLocator('iframe').locator('#highlight-text')
  await expect(paragraph).toBeVisible()
  await paragraph.evaluate((element) => {
    const doc = element.ownerDocument
    const range = doc.createRange()
    range.selectNodeContents(element)
    const selection = doc.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await reader.getByRole('button', { name: 'Highlight pink', exact: true }).click()
  await expect(reader.getByRole('button', { name: 'Add highlight', exact: true })).toBeVisible()
  expect(
    await reader
      .frameLocator('iframe')
      .locator('body')
      .evaluate(
        (body) =>
          (
            body.ownerDocument.defaultView as unknown as {
              CSS: { highlights: Map<string, Set<Range>> }
            }
          ).CSS.highlights.get('papertrail-pink')?.size ?? 0,
      ),
  ).toBe(0)
  await reader.getByRole('button', { name: 'Add highlight', exact: true }).click()
  const painted = async () => {
    await expect
      .poll(() =>
        reader
          .frameLocator('iframe')
          .locator('body')
          .evaluate((element) => {
            const view = element.ownerDocument.defaultView as unknown as {
              CSS: { highlights: Map<string, Set<Range>> }
            }
            return view.CSS.highlights.get('papertrail-pink')?.size ?? 0
          }),
      )
      .toBe(1)
  }
  await painted()
  await page.getByRole('switch', { name: 'Text-only view' }).click()
  await expect(paragraph).toBeVisible()
  await painted()
  await reader.getByRole('button', { name: 'Next chapter' }).click()
  await reader.getByRole('button', { name: 'Previous chapter' }).click()
  await expect(paragraph).toBeVisible()
  await painted()
  await page.reload()
  await open()
  await painted()
  await reader.getByRole('button', { name: 'Annotations', exact: true }).click()
  const panel = reader.getByRole('complementary', { name: 'EPUB utility panel' })
  const saved = panel.locator('[data-annotation-id]')
  await expect(saved).toHaveCount(1)
  await saved.first().click()
  await panel.locator('[data-menu-id]').first().click()
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Add note', exact: true })
    .click()
  const note = 'A local note <img src=x onerror=alert(1)>'
  await page.locator('.floating-popover').getByLabel('Note', { exact: true }).fill(note)
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Save note', exact: true })
    .click()
  await expect(page.locator('.toast-host').getByText('Note saved.', { exact: true })).toBeVisible()
  await expect(saved.first()).toContainText(note)
  await expect(panel.locator('img')).toHaveCount(0)
  await capture(page, info, 'epub-annotation-notes')
  await verifyAnnotationOverview(page, info, 'EPUB')
  await reader.getByRole('button', { name: 'Close utility panel' }).click()
  await expect(reader.getByRole('button', { name: 'Annotations', exact: true })).toBeFocused()
  await page.reload()
  await open()
  await reader.getByRole('button', { name: 'Annotations', exact: true }).click()
  await saved.first().click()
  await panel.locator('[data-menu-id]').first().click()
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Edit note', exact: true })
    .click()
  await expect(page.locator('.floating-popover').getByLabel('Note', { exact: true })).toHaveValue(
    note,
  )
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Delete note', exact: true })
    .click()
  await expect(page.locator('.floating-popover').getByLabel('Note', { exact: true })).toHaveValue(
    '',
  )
  await expect(saved).toHaveCount(1)
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Back to annotation actions', exact: true })
    .click()
  await page.locator('.floating-popover select').first().selectOption('green')
  await expect(page.locator('.floating-popover')).toHaveCount(0)
  await reader.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(reader.getByTestId('highlight-count')).toHaveText('1')
  await expect(reader.getByTestId('note-count')).toHaveText('0')
  await reader.getByRole('button', { name: 'See annotations', exact: true }).click()
  await panel.locator('[data-menu-id]').first().click()
  await page
    .locator('.floating-popover')
    .getByRole('button', { name: 'Delete highlight and note', exact: true })
    .click()
  await expect(saved).toHaveCount(0)
  await reader.getByRole('button', { name: 'Reading insights', exact: true }).click()
  await expect(reader.getByTestId('highlight-count')).toHaveText('0')
  await expect(reader.getByTestId('note-count')).toHaveText('0')
  await reader.getByRole('button', { name: 'See annotations', exact: true }).click()
  await capture(page, info, 'epub-highlights')
  await page.reload()
  await open()
  await reader.getByRole('button', { name: 'Annotations', exact: true }).click()
  await expect(saved).toHaveCount(0)
})

async function verifyAnnotationOverview(page: Page, info: TestInfo, format: 'PDF' | 'EPUB') {
  await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
  const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
  await expect(insights.getByTestId('highlight-count')).toHaveText('1')
  await expect(insights.getByTestId('note-count')).toHaveText('1')
  await capture(page, info, `${format.toLowerCase()}-reading-insights-light`)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await capture(page, info, `${format.toLowerCase()}-reading-insights-dark`)
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await insights.getByRole('button', { name: 'Reset this document’s insights' }).click()
  await insights.getByRole('button', { name: 'Reset insights', exact: true }).click()
  await expect(insights.getByTestId('highlight-count')).toHaveText('1')
  await expect(insights.getByTestId('note-count')).toHaveText('1')
  await insights.getByRole('button', { name: 'See annotations', exact: true }).click()
  await expect(insights).toHaveCount(0)
  await expect(page.locator('[data-annotation-id]')).toHaveCount(1)
  const panel = page.getByRole('complementary', {
    name: format === 'PDF' ? 'PDF annotations panel' : 'EPUB utility panel',
  })
  const filter = panel.getByLabel('Find annotations', { exact: true })
  await filter.fill('no matching annotation anywhere')
  await expect(panel.locator('[data-annotation-id]')).toHaveCount(0)
  await filter.fill('note')
  await expect(panel.locator('[data-annotation-id]')).toHaveCount(1)
  await filter.fill('')
  await panel.locator('summary').click()
  await panel.getByLabel('Filter by highlight color', { exact: true }).selectOption('blue')
  await expect(panel.locator('[data-annotation-id]')).toHaveCount(0)
  await panel.getByLabel('Filter by highlight color', { exact: true }).selectOption('')
  await panel.getByLabel('With notes only', { exact: true }).check()
  await expect(panel.locator('[data-annotation-id]')).toHaveCount(1)
  await panel.getByLabel('With notes only', { exact: true }).uncheck()
  await panel.locator('summary').click()
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} reading insights persist native checkpoints and resume after lifecycle pause and idle`, async ({
    page,
  }) => {
    // Virtual time drives deadlines; IndexedDB and reader rendering remain native.
    // Synthetic page lifecycle events verify handlers, not OS window-switch delivery.
    await page.clock.install()
    await page.goto('./#/app')
    const file =
      format === 'PDF'
        ? { name: 'insights.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(2) }
        : {
            name: 'insights.epub',
            mimeType: 'application/epub+zip',
            buffer: Buffer.from(createEpubFixture()),
          }
    const open = async (target = page) => {
      const show = target.getByRole('button', { name: 'Show library', exact: true })
      if (await show.isVisible()) await show.click()
      await target.locator('input[accept*=".pdf"]').setInputFiles(file)
      await target
        .locator('section[aria-labelledby="local-library-title"]')
        .getByRole('button', { name: new RegExp(file.name) })
        .click()
      const hide = target.getByRole('button', { name: 'Hide library' })
      if (await hide.isVisible()) await hide.click()
      await expect(
        target.getByRole('button', { name: 'Reading insights', exact: true }),
      ).toBeEnabled()
      const insightsToggle = target.getByRole('button', { name: 'Reading insights', exact: true })
      // PDF restores the saved utility mode; do not toggle a restored panel closed.
      if ((await insightsToggle.getAttribute('aria-expanded')) !== 'true')
        await insightsToggle.click()
      await expect(insightsToggle).toHaveAttribute('aria-expanded', 'true')
    }
    await open()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(insights).toContainText(format === 'PDF' ? 'Page position' : 'Chapter position')
    await expect(insights.getByTestId('highlight-count')).toHaveText('0')
    await expect(insights.getByTestId('note-count')).toHaveText('0')
    const storedTime = () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('papertrail-statistics')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        try {
          return await new Promise<number>((resolve, reject) => {
            const request = db.transaction('documents').objectStore('documents').getAll()
            request.onsuccess = () =>
              resolve(
                request.result
                  .filter(
                    (record) =>
                      typeof record.id === 'string' && record.id.startsWith('statistics:'),
                  )
                  .reduce((sum, record) => sum + record.activeMs, 0),
              )
            request.onerror = () => reject(request.error)
          })
        } finally {
          db.close()
        }
      })
    await page.clock.runFor(16_000)
    await expect.poll(storedTime).toBeGreaterThan(0)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await expect.poll(storedTime).toBeGreaterThan(0)
    const paused = await storedTime()
    await page.clock.runFor(20_000)
    const display = await insights.innerText()
    await page.clock.runFor(2_000)
    expect(await insights.innerText()).toBe(display)
    expect(await storedTime()).toBe(paused)
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
    await page.clock.runFor(16_000)
    await expect.poll(storedTime).toBeGreaterThan(paused)
    await page.clock.runFor(65_000)
    await expect(insights).toContainText('Paused for inactivity')
    const idleTime = await storedTime()
    await page.clock.runFor(5_000)
    expect(await storedTime()).toBe(idleTime)
    if (format === 'EPUB') {
      await page
        .getByRole('region', { name: 'EPUB reader' })
        .frameLocator('iframe')
        .locator('body')
        .dispatchEvent('pointerdown')
    } else await insights.dispatchEvent('pointerdown', { bubbles: true })
    await page.clock.runFor(16_000)
    await expect.poll(storedTime).toBeGreaterThan(idleTime)
    const saved = await storedTime()
    await page.reload()
    await open()
    await expect.poll(storedTime).toBeGreaterThanOrEqual(saved)
    await insights.getByRole('button', { name: 'Reset this document’s insights' }).click()
    await insights.getByRole('button', { name: 'Reset insights', exact: true }).click()
    await expect.poll(storedTime).toBe(0)
    await expect(insights.getByTestId('highlight-count')).toHaveText('0')
    await page.clock.runFor(16_000)
    await expect.poll(storedTime).toBeGreaterThan(0)
    const other = await page.context().newPage()
    await other.goto('./#/app')
    await open(other)
    const otherInsights = other.getByRole('region', { name: 'Local reading insights', exact: true })
    await otherInsights.getByRole('button', { name: 'Reset this document’s insights' }).click()
    await otherInsights.getByRole('button', { name: 'Reset insights', exact: true }).click()
    await expect(
      otherInsights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeEnabled()
    await page.bringToFront()
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await expect(insights).toContainText('Insights were reset in another tab')
    await other.close()
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
    await insights.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(insights.getByRole('alert')).toHaveCount(0)
    await page.clock.runFor(16_000)
    await expect.poll(storedTime).toBeGreaterThan(0)
  })
}

test('PDF native margin and outside-page drags retain the intended anchor in both directions', async ({
  page,
}) => {
  await page.goto('./#/app')
  await page.locator('input[accept*=".pdf"]').setInputFiles({
    name: 'native-drag.pdf',
    mimeType: 'application/pdf',
    buffer: createPdfFixture(1),
  })
  await page.getByRole('button', { name: 'PDF: native-drag.pdf', exact: true }).click()
  await page.getByRole('button', { name: 'Hide library' }).click()
  await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
  const text = page.locator('#pdf-page-1 .textLayer span').first()
  await expect(text).toBeVisible()
  const line = (await text.boundingBox())!,
    sheet = (await page.locator('#pdf-page-1').boundingBox())!
  const y = line.y + line.height / 2
  await page.mouse.move(Math.max(sheet.x + 2, line.x - 6), y)
  await page.mouse.down()
  await page.mouse.move(line.x + line.width - 1, y, { steps: 8 })
  await page.mouse.move(Math.max(1, sheet.x - 5), y + line.height * 2, { steps: 5 })
  await page.mouse.move(line.x + line.width - 1, y, { steps: 5 })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toContain('First page')
  await expect(page.getByRole('button', { name: 'Add highlight', exact: true })).toBeVisible()
  await page.mouse.move(line.x + line.width - 1, y)
  await page.mouse.down()
  await page.mouse.move(Math.max(sheet.x + 2, line.x - 6), y, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString()))
    .toContain('First page')
})

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} insights storage rejection leaves reading usable and retry recovers`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = indexedDB.open.bind(indexedDB)
      let blocked = true
      indexedDB.open = ((name: string, version?: number) => {
        if (blocked && name === 'papertrail-statistics')
          throw new DOMException('Test storage rejection', 'SecurityError')
        return version === undefined ? original(name) : original(name, version)
      }) as typeof indexedDB.open
      Reflect.set(window, 'allowInsightsStorage', () => {
        blocked = false
      })
    })
    await page.goto('./#/app')
    const file =
      format === 'PDF'
        ? { name: 'failure.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(1) }
        : {
            name: 'failure.epub',
            mimeType: 'application/epub+zip',
            buffer: Buffer.from(createEpubFixture()),
          }
    await page.locator('input[accept*=".pdf"]').setInputFiles(file)
    await page
      .locator('section[aria-labelledby="local-library-title"]')
      .getByRole('button', { name: new RegExp(file.name) })
      .click()
    await page.getByRole('button', { name: 'Hide library' }).click()
    await page.getByRole('button', { name: 'Reading insights', exact: true }).click()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(insights).toContainText('Local reading insights are unavailable')
    if (format === 'PDF')
      await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
    else
      await expect(
        page
          .getByRole('region', { name: 'EPUB reader' })
          .frameLocator('iframe')
          .getByRole('heading', { name: 'First chapter' }),
      ).toBeVisible()
    await page.evaluate(() => (Reflect.get(window, 'allowInsightsStorage') as () => void)())
    await insights.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(insights.getByRole('alert')).toHaveCount(0)
    await expect(
      insights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeEnabled()
  })
}

for (const format of ['PDF', 'EPUB'] as const) {
  test(`${format} preserves unsupported insights metadata while the document remains readable`, async ({
    page,
  }) => {
    const file =
      format === 'PDF'
        ? { name: 'schema.pdf', mimeType: 'application/pdf', buffer: createPdfFixture(1) }
        : {
            name: 'schema.epub',
            mimeType: 'application/epub+zip',
            buffer: Buffer.from(createEpubFixture()),
          }
    const open = async () => {
      const show = page.getByRole('button', { name: 'Show library', exact: true })
      if (await show.isVisible()) await show.click()
      await page.locator('input[accept*=".pdf"]').setInputFiles(file)
      await page
        .locator('section[aria-labelledby="local-library-title"]')
        .getByRole('button', { name: new RegExp(file.name) })
        .click()
      await page.getByRole('button', { name: 'Hide library' }).click()
      const toggle = page.getByRole('button', { name: 'Reading insights', exact: true })
      await expect(toggle).toBeEnabled()
      if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    }
    await page.goto('./#/app')
    await open()
    const insights = page.getByRole('region', { name: 'Local reading insights', exact: true })
    await expect(
      insights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeEnabled()
    await page.goto('./#/')
    const unsupportedId = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('papertrail-statistics')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<string>((resolve, reject) => {
          const tx = db.transaction('documents', 'readwrite'),
            store = tx.objectStore('documents')
          const request = store.getAll()
          let id = ''
          request.onsuccess = () => {
            const summary = request.result.find(
              (record) => typeof record.id === 'string' && record.id.startsWith('statistics:'),
            )
            id = summary.id
            store.put({ ...summary, version: 999 })
          }
          tx.oncomplete = () => resolve(id)
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    })
    await page.goto('./#/app')
    await open()
    await expect(insights).toContainText('Local reading insights are unavailable')
    await insights.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(insights).toContainText('Local reading insights are unavailable')
    if (format === 'PDF')
      await expect(page.locator('#pdf-page-1')).toHaveAttribute('data-render-state', 'ready')
    else
      await expect(
        page
          .getByRole('region', { name: 'EPUB reader' })
          .frameLocator('iframe')
          .getByRole('heading', { name: 'First chapter' }),
      ).toBeVisible()
    const preserved = await page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('papertrail-statistics')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        return await new Promise<number>((resolve, reject) => {
          const request = db.transaction('documents').objectStore('documents').get(id)
          request.onsuccess = () => resolve(request.result.version)
          request.onerror = () => reject(request.error)
        })
      } finally {
        db.close()
      }
    }, unsupportedId)
    expect(preserved).toBe(999)
    await expect(
      insights.getByRole('button', { name: 'Reset this document’s insights' }),
    ).toBeDisabled()
  })
}
