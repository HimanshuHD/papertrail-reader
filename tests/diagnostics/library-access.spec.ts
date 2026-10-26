import { expect, test } from '@playwright/test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPdfFixture } from '../fixtures/pdf'
import { waitForWorkspaceReady } from '../fixtures/browser'

for (const [scenario, errorName] of [
  ['picker-cancel', 'AbortError'],
  ['picker-denied', 'NotAllowedError'],
  ['picker-unavailable', 'SecurityError'],
] as const) {
  test(`controlled ${scenario} preserves an open reader and permits recovery`, async ({
    page,
    browserName,
  }, info) => {
    // Deliberate capability simulation, not an OS permission/revocation test.
    await page.addInitScript((name) => {
      Reflect.set(window, 'controlledPickerCalls', 0)
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => {
          Reflect.set(
            window,
            'controlledPickerCalls',
            Reflect.get(window, 'controlledPickerCalls') + 1,
          )
          throw new DOMException('Controlled rejection', name)
        },
      })
    }, errorName)
    await page.goto('./#/app')
    await waitForWorkspaceReady(page)
    expect(
      await page.evaluate(() => ({
        secure: isSecureContext,
        picker: typeof Reflect.get(window, 'showDirectoryPicker'),
      })),
    ).toEqual({ secure: true, picker: 'function' })
    const toggle = page.getByRole('button', { name: 'Developer diagnostics', exact: true })
    await toggle.click()
    await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
    const exported = async () => {
      await toggle.click()
      const pending = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export local JSON', exact: true }).click()
      const file = await pending
      const text = await readFile((await file.path())!, 'utf8')
      expect(text).not.toMatch(/access-private|recovery-private/)
      const data = JSON.parse(text)
      expect(data.identity.sourceSha).toBe(process.env.DIAGNOSTIC_EXPECTED_SHA)
      await page.getByRole('button', { name: 'Minimize diagnostics', exact: true }).click()
      return data
    }
    await page.locator('input[accept*=".pdf"]').setInputFiles({
      name: 'access-private.pdf',
      mimeType: 'application/pdf',
      buffer: createPdfFixture(6),
    })
    const entry = page.getByRole('button', { name: 'PDF: access-private.pdf', exact: true })
    await entry.click()
    await expect(page.locator('[data-pdf-page="1"]')).toHaveAttribute('data-render-state', 'ready')
    const pageNumber = page.getByRole('spinbutton', { name: 'Current page', exact: true })
    await pageNumber.fill('3')
    await pageNumber.press('Tab')
    await expect(page.locator('[data-pdf-page="3"]')).toHaveAttribute('data-render-state', 'ready')
    await page
      .locator('.pdf-reader')
      .evaluate((el) => el.setAttribute('data-access-probe', 'retained'))
    const before = (await exported()).resources
    const chooseFolder = async () => {
      await page.getByRole('button', { name: /^(Add local documents|Library actions)$/ }).click()
      await page.getByRole('menuitem', { name: 'Choose folder', exact: true }).click()
    }
    // Reproduce platforms that move focus out on mouse press before click. The
    // command must survive this default action without bypassing real pointer input.
    await page.evaluate(() => {
      document.addEventListener('mousedown', (event) => {
        if (
          !event.defaultPrevented &&
          event.target instanceof Element &&
          event.target.closest('[role="menuitem"]')
        )
          document.querySelector<HTMLInputElement>('#library-filter')?.focus()
      })
    })
    await chooseFolder()
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'controlledPickerCalls')))
      .toBe(1)
    await expect(page.locator('#library-source-status')).toContainText(
      scenario === 'picker-unavailable'
        ? 'Native folder access is unavailable'
        : 'cancelled or permission was not granted',
    )
    await expect(entry).toHaveAttribute('aria-pressed', 'true')
    await expect(pageNumber).toHaveValue('3')
    await expect(page.locator('.pdf-reader')).toHaveAttribute('data-access-probe', 'retained')
    await expect(
      page.getByRole('tablist', { name: 'Open documents' }).getByRole('tab'),
    ).toHaveCount(1)
    const after = (await exported()).resources
    const keys = ['viewers', 'pdfWorkerOwners', 'blobURLs'] as const
    expect(before.viewers).toBe(1)
    expect(before.pdfWorkerOwners).toBeGreaterThan(0)
    // Recorder ownership maps are sparse: an unregistered named counter is zero.
    // This is not an unsupported browser sensor reading.
    const resourceDelta = keys.map((key) => (after[key] ?? 0) - (before[key] ?? 0))
    expect(resourceDelta).toEqual([0, 0, 0])
    await page.getByRole('button', { name: 'Next page', exact: true }).click()
    await expect(pageNumber).toHaveValue('4')
    await expect(page.locator('[data-pdf-page="4"]')).toHaveAttribute('data-render-state', 'ready')
    if (scenario === 'picker-unavailable') {
      // Exercise the actual directory-input fallback with disposable generated files.
      const folder = await mkdtemp(join(tmpdir(), 'papertrail-access-'))
      try {
        await writeFile(join(folder, 'recovery-private.pdf'), createPdfFixture(2))
        const pending = page.waitForEvent('filechooser')
        await chooseFolder()
        await (await pending).setFiles(folder)
        const recovery = page.getByRole('button', {
          name: 'PDF: recovery-private.pdf',
          exact: true,
        })
        await recovery.click()
        await expect(
          page.getByRole('spinbutton', { name: 'Current page', exact: true }),
        ).toHaveValue('1')
        await expect(page.locator('.pdf-reader:visible [data-pdf-page="1"]')).toHaveAttribute(
          'data-render-state',
          'ready',
        )
        await exported()
      } finally {
        await rm(folder, { recursive: true, force: true })
      }
    }
    await info.attach('library-access-functional-evidence', {
      body: JSON.stringify({
        engine: browserName,
        scenario,
        mechanism: 'controlled-picker-rejection',
        preserved: true,
        resourceDelta,
        recovery: scenario === 'picker-unavailable' ? 'directory-input' : 'continued-reading',
      }),
      contentType: 'application/json',
    })
  })
}
