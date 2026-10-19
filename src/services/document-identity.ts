// Files are immutable snapshots. Cache only completed identities, never document bytes
// or pending work, and allow File objects to be garbage-collected with their tabs/library.
const completed = new WeakMap<File, string>()

/** Full-content identity with bounded reads; no PDF page rendering or bytes persisted. */
export async function fingerprintDocument(file: File, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted()
  const cached = completed.get(file)
  if (cached) return cached
  const hashes: string[] = []
  const chunkSize = 1024 * 1024
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    signal?.throwIfAborted()
    const bytes = await file.slice(offset, offset + chunkSize).arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    hashes.push(
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    )
  }
  signal?.throwIfAborted()
  const manifest = new TextEncoder().encode(`${file.size}:${hashes.join(':')}`)
  const digest = await crypto.subtle.digest('SHA-256', manifest)
  signal?.throwIfAborted()
  const fingerprint = `sha256-chunks-v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
  completed.set(file, fingerprint)
  return fingerprint
}
