import { expect, test, type Page, type Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createPdfFixture } from '../fixtures/pdf'
import { createEpubFixture } from '../fixtures/epub'
import { waitForWorkspaceReady, settleReaderLayout } from '../fixtures/browser'
import type { AnnotationExport } from '../../src/services/annotation-export'

async function download(page: Page, button: Locator) {
  const received = page.waitForEvent('download')
  await button.focus()
  await button.press('Enter')
  const file = await received
  expect(await file.failure()).toBeNull()
  expect(file.suggestedFilename()).toMatch(/^papertrail-.+-annotations\.json$/u)
  return JSON.parse(await readFile((await file.path())!, 'utf8')) as AnnotationExport
}

test('PDF and EPUB JSON downloads preserve saved references, ignore filters and isolate documents', async ({
  page,
}, info) => {
  await page.goto('./#/app')
  await waitForWorkspaceReady(page)
  await page.locator('input[accept*=".pdf"]').setInputFiles([
    {
      name: 'export.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(2, undefined, true),
    },
    {
      name: 'export.epub',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(
        createEpubFixture({
          chapter:
            '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First chapter</title></head><body><h1>First chapter</h1><p id="export-text">Portable EPUB quotation.</p></body></html>',
        }),
      ),
    },
  ])
  const snapshots: AnnotationExport[] = []
  for (const format of ['PDF', 'EPUB'] as const) {
    const show = page.getByRole('button', { name: 'Show library', exact: true })
    if (await show.isVisible()) await show.click()
    await page
      .getByRole('region', { name: 'Library documents', exact: true })
      .getByRole('button', { name: `${format}: export.${format.toLowerCase()}`, exact: true })
      .click()
    await page.getByRole('button', { name: 'Hide library', exact: true }).click()
    await settleReaderLayout(page.locator('.reader-layout'))
    if (format === 'PDF') {
      await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute(
        'data-render-state',
        'ready',
      )
      await page
        .locator('[data-pdf-page="1"] .textLayer span')
        .first()
        .evaluate((element) => {
          const range = document.createRange()
          range.selectNodeContents(element)
          document.getSelection()!.removeAllRanges()
          document.getSelection()!.addRange(range)
          document.dispatchEvent(new Event('selectionchange'))
        })
    } else {
      const paragraph = page
        .getByRole('region', { name: 'EPUB reader' })
        .frameLocator('iframe')
        .locator('#export-text')
      await expect(paragraph).toBeVisible()
      await paragraph.evaluate((element) => {
        const doc = element.ownerDocument
        const range = doc.createRange()
        range.selectNodeContents(element)
        doc.getSelection()!.removeAllRanges()
        doc.getSelection()!.addRange(range)
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      })
    }
    const note = `${format} saved note: नमस्ते 🌿 <script>plain text</script>`
    await page.getByRole('button', { name: 'Add note', exact: true }).click()
    await page.locator(`[id$=${format.toLowerCase()}-selection-note]`).fill(note)
    await page.getByRole('button', { name: 'Save highlight with note', exact: true }).click()
    await page.getByRole('button', { name: 'Annotations', exact: true }).click()
    const panel = page.locator('.annotation-panel:visible')
    await expect(panel.locator('[data-annotation-id]')).toHaveCount(1)
    const button = panel.getByRole('button', { name: 'Export annotations (JSON)', exact: true })
    await expect(button).toBeEnabled()
    await panel
      .getByRole('searchbox', { name: 'Find annotations' })
      .fill('no match for this filter')
    await expect(panel.locator('[data-annotation-id]')).toHaveCount(0)
    const first = await download(page, button)
    expect(first.schema).toBe('papertrail.annotations')
    expect(first.version).toBe(1)
    expect(first.document).toMatchObject({
      format,
      name: `export.${format.toLowerCase()}`,
      fingerprint: expect.stringMatching(/^sha256-chunks-v1:[a-f0-9]{64}$/u),
    })
    expect(first.annotations).toHaveLength(1)
    expect(first.annotations[0]!.note).toBe(note)
    expect(first.annotations[0]!.selector.format).toBe(format)
    expect(Object.keys(first)).toEqual([
      'schema',
      'version',
      'exportedAt',
      'document',
      'annotations',
    ])
    expect(Object.keys(first.document).sort()).toEqual(['fingerprint', 'format', 'name'])
    const second = await download(page, button)
    expect(second.annotations).toEqual(first.annotations)
    expect(second.document).toEqual(first.document)
    await panel.getByRole('searchbox', { name: 'Find annotations' }).fill('')
    await expect(panel.locator('[data-annotation-id]')).toHaveCount(1)
    snapshots.push(first)
    await info.attach(`${format.toLowerCase()}-export-panel`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await page.getByRole('button', { name: 'Close utility panel', exact: true }).click()
  }
  expect(snapshots[0]!.document.fingerprint).not.toBe(snapshots[1]!.document.fingerprint)
  expect(snapshots[0]!.annotations[0]!.id).not.toBe(snapshots[1]!.annotations[0]!.id)
  await page.getByRole('tab', { name: /export.pdf/ }).click()
  await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Annotations', exact: true }).click()
  const restored = await download(
    page,
    page
      .locator('.annotation-panel:visible')
      .getByRole('button', { name: 'Export annotations (JSON)', exact: true }),
  )
  expect(restored.annotations).toEqual(snapshots[0]!.annotations)
})
