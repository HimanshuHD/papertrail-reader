import { zipSync } from 'fflate'

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Record<string, Uint8Array>>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}
scope.onmessage = (event) => {
  try {
    const bytes = zipSync(event.data, { level: 0 })
    scope.postMessage({ bytes }, [bytes.buffer as ArrayBuffer])
  } catch {
    scope.postMessage({ error: true })
  }
}
