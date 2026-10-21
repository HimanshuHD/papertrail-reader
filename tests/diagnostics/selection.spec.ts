import { test, expect } from '@playwright/test'
import { selectWorkloadDocument, workloadFailureEvidence } from '../fixtures/diagnostic-workload'

test('library stays open until asynchronous document selection commits', async ({ page }) => {
  await page.setContent(
    '<button aria-label="Show library" hidden>Show</button><button aria-label="Hide library">Hide</button><section role="region" aria-label="Library documents"><button aria-label="EPUB: acceptance.epub" aria-pressed="false">Book</button></section><div role="tablist" aria-label="Open documents"></div>',
  )
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[aria-label="Hide library"]')!.onclick = () => {
      Reflect.set(window, 'closedEarly', !document.querySelector('[role="tab"]'))
      document.querySelector<HTMLElement>('[role="region"]')!.hidden = true
    }
    document.querySelector<HTMLButtonElement>('[aria-label="EPUB: acceptance.epub"]')!.onclick = (
      event,
    ) => {
      ;(event.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true')
      setTimeout(() => {
        const tab = document.createElement('button')
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', 'true')
        tab.setAttribute('aria-label', 'EPUB: acceptance.epub — Ready')
        document.querySelector('[role="tablist"]')!.append(tab)
      }, 100)
    }
  })
  await selectWorkloadDocument(page, 'EPUB')
  await expect(page.getByRole('tab', { name: /EPUB: acceptance.epub/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(await page.evaluate(() => Reflect.get(window, 'closedEarly'))).toBe(false)
})
test('failure snapshot retains numeric selection evidence without document labels or URLs', async ({
  page,
}) => {
  await page.setContent(
    '<div role="tablist" aria-label="Open documents"><button role="tab" aria-selected="true" aria-label="PDF: PRIVATE_DOCUMENT">private</button></div><div class="pdf-reader"></div>',
  )
  const evidence = await workloadFailureEvidence(page, {
    engine: 'webkit',
    trial: 2,
    mode: 'sampling',
    stage: 'epubOpen',
    failedStageElapsedMs: 20,
    completedStages: { pdfOpen: 5 },
    pageErrors: ['TypeError'],
  })
  expect(evidence.ui).toMatchObject({
    selectedFormat: 'pdf',
    pdfTabs: 1,
    epubTabs: 0,
    captured: true,
  })
  expect(JSON.stringify(evidence)).not.toContain('PRIVATE_DOCUMENT')
  await page.close()
  const closed = await workloadFailureEvidence(page, {
    engine: 'webkit',
    trial: 2,
    mode: 'sampling',
    stage: 'epubOpen',
    failedStageElapsedMs: 20,
    completedStages: {},
    pageErrors: [],
  })
  expect(closed.ui).toBeNull()
})
