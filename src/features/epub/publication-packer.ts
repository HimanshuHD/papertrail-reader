import { zipSync } from 'fflate'

// Startup crossover heuristic, not a publication limit or a universal time budget.
const WORKER_THRESHOLD = 4 * 1024 * 1024

/** Only already-validated, rebuilt resources reach this byte-packing boundary. */
export async function packPublication(
  files: Record<string, Uint8Array>,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted()
  const inputs = Object.values(files)
  const buffers = [...new Set(inputs.map((bytes) => bytes.buffer))]
  if (
    inputs.reduce((sum, bytes) => sum + bytes.byteLength, 0) < WORKER_THRESHOLD ||
    typeof Worker === 'undefined' ||
    buffers.some((buffer) => !(buffer instanceof ArrayBuffer))
  )
    return zipSync(files, { level: 0 })

  let worker: Worker
  try {
    worker = new Worker(new URL('./publication-packer.worker.ts', import.meta.url), {
      type: 'module',
    })
  } catch {
    // No transfer occurred: restrictive/unsupported environments retain the bounded sync path.
    return zipSync(files, { level: 0 })
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (bytes?: Uint8Array, error?: unknown) => {
      if (settled) return
      settled = true
      worker.removeEventListener('message', message)
      worker.removeEventListener('error', failed)
      worker.removeEventListener('messageerror', failed)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      if (error !== undefined) reject(error)
      else resolve(bytes!)
    }
    const abort = () =>
      finish(undefined, signal?.reason ?? new DOMException('EPUB packing cancelled.', 'AbortError'))
    const message = (event: MessageEvent) => {
      if (signal?.aborted) {
        abort()
        return
      }
      if (event.data?.bytes instanceof Uint8Array) finish(event.data.bytes)
      else finish(undefined, new Error('Unable to prepare EPUB archive.'))
    }
    const failed = (event: Event) => {
      event.preventDefault()
      finish(undefined, new Error('Unable to prepare EPUB archive.'))
    }
    worker.addEventListener('message', message)
    worker.addEventListener('error', failed)
    worker.addEventListener('messageerror', failed)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    try {
      // These chapter buffers are no longer read by the main-thread preparation path.
      worker.postMessage(files, buffers as ArrayBuffer[])
    } catch (error) {
      // After transfer starts, report failure rather than repacking detached inputs.
      finish(undefined, error)
    }
  })
}
