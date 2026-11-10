// Controlled synthetic smoke measurement, not a reader workload budget or total instrumentation cost.
// Run: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node scripts/benchmark-diagnostic-sensors.mjs
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const serveFixture = (server) => {
  server.middlewares.use('/__sensor-benchmark', (_request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end(`<button id="work">Controlled interaction</button><script type="module">
    import { ResponsivenessSensors } from '/src/features/diagnostics/responsiveness.ts';
    window.sensors = new ResponsivenessSensors();
    let count = 0;
    document.querySelector('button').onclick = () => {
      const end = performance.now() + (++count % 6 === 0 ? 70 : 20);
      while (performance.now() < end) {}
    };
    window.ready = true;
  </script>`)
  })
}
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
  plugins: [{ name: 'sensor-benchmark-fixture', configureServer: serveFixture }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  })
  const page = await browser.newPage()
  const address = server.httpServer.address()
  const base = `http://127.0.0.1:${address.port}`
  const trials = []
  // Alternate order to limit warm-up bias. Timing includes automation/browser rendering noise.
  for (const enabled of [false, true, true, false, false, true]) {
    await page.goto(`${base}/__sensor-benchmark`)
    await page.waitForFunction(() => window.ready)
    await page.evaluate((enabled) => {
      if (enabled) window.sensors.start()
    }, enabled)
    const started = performance.now()
    for (let i = 0; i < 30; i++) await page.locator('button').click()
    await page.evaluate(async () => {
      await fetch('/package.json?sensor-smoke=1', { cache: 'no-store' })
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    await page.waitForTimeout(150)
    const snapshot = await page.evaluate(() => {
      window.sensors.stop()
      return window.sensors.snapshot()
    })
    if (
      enabled &&
      (!snapshot.inputs.length || !snapshot.frames.length || !snapshot.resources.length)
    ) {
      throw new Error('Chromium did not capture all three expected sensor types')
    }
    trials.push({
      enabled,
      elapsedMs: performance.now() - started,
      captured: {
        inputs: snapshot.inputs.length,
        frames: snapshot.frames.length,
        resources: snapshot.resources.length,
      },
      callbacks: snapshot.overhead,
    })
    if (snapshot.active) throw new Error('Observers did not stop')
  }
  console.log(
    JSON.stringify(
      {
        browser: await browser.version(),
        interactionsPerTrial: 30,
        workload:
          'Synthetic 20 ms handlers with every sixth handler 70 ms; one resource fetch. No reader document workload.',
        limitations:
          'Callback timings exclude native observer instrumentation and Vue rendering; elapsed includes automation. Not calibration, INP, CPU usage or production overhead proof. Sensors stay opt-in.',
        trials,
      },
      null,
      2,
    ),
  )
} finally {
  await browser?.close()
  await server.close()
}
