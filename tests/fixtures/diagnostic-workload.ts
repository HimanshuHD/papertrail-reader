import { expect, type Page } from '@playwright/test'

/** Observe committed tab selection before changing sidebar focus/layout. */
export async function selectWorkloadDocument(page: Page, format: 'PDF' | 'EPUB') {
  const show = page.getByRole('button', { name: 'Show library', exact: true })
  if (await show.isVisible()) await show.click()
  const name = `${format}: acceptance.${format === 'PDF' ? 'pdf' : 'epub'}`
  const entry = page
    .getByRole('region', { name: 'Library documents', exact: true })
    .getByRole('button', { name, exact: true })
  await entry.click()
  await expect(entry).toHaveAttribute('aria-pressed', 'true')
  const tab = page.getByRole('tab', {
    name: format === 'PDF' ? /^PDF: acceptance\.pdf/ : /^EPUB: acceptance\.epub/,
  })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Hide library', exact: true }).click()
}

/** Numeric/fixed-vocabulary state only. Raw exceptions, DOM content and URLs stay in local Playwright artifacts. */
export async function workloadFailureEvidence(
  page: Page,
  identity: {
    engine: string
    trial: number
    mode: string
    stage: string
    failedStageElapsedMs: number
    completedStages: Record<string, number>
    pageErrors: string[]
  },
) {
  let ui: {
    selectedFormat: 'pdf' | 'epub' | 'none' | 'other'
    pdfTabs: number
    epubTabs: number
    pdfReaders: number
    epubReaders: number
    loadingCards: number
    captured: boolean
  } | null = null
  try {
    ui = await page.evaluate(() => {
      const tabs = [
        ...document.querySelectorAll('[role="tablist"][aria-label="Open documents"] [role="tab"]'),
      ]
      const label =
        tabs
          .find((tab) => tab.getAttribute('aria-selected') === 'true')
          ?.getAttribute('aria-label') ?? ''
      const selectedFormat = !tabs.some((tab) => tab.getAttribute('aria-selected') === 'true')
        ? 'none'
        : label.startsWith('PDF:')
          ? 'pdf'
          : label.startsWith('EPUB:')
            ? 'epub'
            : 'other'
      return {
        selectedFormat,
        pdfTabs: tabs.filter((tab) => tab.getAttribute('aria-label')?.startsWith('PDF:')).length,
        epubTabs: tabs.filter((tab) => tab.getAttribute('aria-label')?.startsWith('EPUB:')).length,
        pdfReaders: document.querySelectorAll('.pdf-reader').length,
        epubReaders: document.querySelectorAll('.epub-reader').length,
        loadingCards: document.querySelectorAll('.loading-card').length,
        captured: true,
      }
    })
  } catch {
    /* A closed/crashed page is explicitly uncaptured, not measured zero. */
  }
  return { ...identity, ui }
}
