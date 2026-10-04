/** Metadata-only ZIP preflight. Does not decompress, parse XML or authorize rendering. */
export const EPUB_ARCHIVE_LIMITS = Object.freeze({
  archiveBytes: 128 * 1024 * 1024,
  directoryBytes: 4 * 1024 * 1024,
  entries: 4096,
  entryBytes: 32 * 1024 * 1024,
  expandedBytes: 256 * 1024 * 1024,
  compressionRatio: 200,
})

export class EpubArchiveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EpubArchiveError'
  }
}

export interface EpubArchiveEntry {
  crc: number
  path: string
  method: 0 | 8
  compressedBytes: number
  expandedBytes: number
  dataOffset: number
}

interface ZipEntry extends EpubArchiveEntry {
  flags: number
  crc: number
  localOffset: number
  nameBytes: Uint8Array
}

function requireArchive(condition: boolean, message: string): asserts condition {
  if (!condition) throw new EpubArchiveError(message)
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function checkExtra(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset < bytes.length) {
    requireArchive(offset + 4 <= bytes.length, 'Malformed ZIP extra field.')
    const tag = view.getUint16(offset, true)
    const size = view.getUint16(offset + 2, true)
    requireArchive(
      tag !== 1 && tag !== 0x7075,
      'ZIP64 and alternate filename fields are unsupported.',
    )
    offset += 4 + size
    requireArchive(offset <= bytes.length, 'Truncated ZIP extra field.')
  }
}

function decodePath(bytes: Uint8Array, flags: number): string {
  requireArchive(bytes.length > 0, 'ZIP entry has no filename.')
  requireArchive(
    Boolean(flags & 0x800) || bytes.every((byte) => byte < 128),
    'Non-UTF-8 filenames are unsupported.',
  )
  let path: string
  try {
    path = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new EpubArchiveError('Invalid UTF-8 filename.')
  }
  requireArchive(
    !/[\\:%?#]/u.test(path) &&
      !Array.from(path).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ) &&
      !path.startsWith('/'),
    'Unsafe ZIP entry path.',
  )
  const segments = path.replace(/\/$/, '').split('/')
  requireArchive(
    segments.every((part) => part !== '' && part !== '.' && part !== '..'),
    'Unsafe ZIP entry path.',
  )
  return path
}

/** Inspect a local Blob with bounded reads; all limits are fixed application policy. */
export async function preflightEpubArchive(
  file: Blob,
  signal?: AbortSignal,
): Promise<readonly EpubArchiveEntry[]> {
  signal?.throwIfAborted()
  requireArchive(
    file.size >= 22 && file.size <= EPUB_ARCHIVE_LIMITS.archiveBytes,
    'EPUB archive size is unsupported.',
  )
  async function read(offset: number, length: number) {
    signal?.throwIfAborted()
    requireArchive(
      offset >= 0 && length >= 0 && offset + length <= file.size,
      'Truncated EPUB archive.',
    )
    const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())
    signal?.throwIfAborted()
    requireArchive(bytes.length === length, 'Truncated EPUB archive.')
    return bytes
  }
  const tailOffset = Math.max(0, file.size - 65557)
  const tail = await read(tailOffset, file.size - tailOffset)
  const tailView = new DataView(tail.buffer)
  let end = -1
  for (let offset = tail.length - 22; offset >= 0; offset--) {
    if (
      tailView.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + tailView.getUint16(offset + 20, true) === tail.length
    ) {
      end = offset
      break
    }
  }
  requireArchive(end >= 0, 'ZIP end record is missing.')
  const count = tailView.getUint16(end + 10, true)
  const directorySize = tailView.getUint32(end + 12, true)
  const directoryOffset = tailView.getUint32(end + 16, true)
  requireArchive(
    tailView.getUint16(end + 4, true) === 0 &&
      tailView.getUint16(end + 6, true) === 0 &&
      tailView.getUint16(end + 8, true) === count,
    'Multidisk ZIP archives are unsupported.',
  )
  requireArchive(
    count > 0 &&
      count <= EPUB_ARCHIVE_LIMITS.entries &&
      directorySize <= EPUB_ARCHIVE_LIMITS.directoryBytes,
    'ZIP directory exceeds application limits.',
  )
  requireArchive(
    directoryOffset + directorySize === tailOffset + end,
    'ZIP64 or inconsistent directory layout.',
  )
  const directory = await read(directoryOffset, directorySize)
  const view = new DataView(directory.buffer)
  const entries: ZipEntry[] = []
  const paths = new Set<string>()
  let cursor = 0
  let total = 0
  for (let index = 0; index < count; index++) {
    signal?.throwIfAborted()
    requireArchive(
      cursor + 46 <= directory.length && view.getUint32(cursor, true) === 0x02014b50,
      'Malformed ZIP directory entry.',
    )
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compressedBytes = view.getUint32(cursor + 20, true)
    const expandedBytes = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    requireArchive(
      view.getUint16(cursor + 34, true) === 0 && view.getUint16(cursor + 6, true) <= 20,
      'Unsupported ZIP version or disk.',
    )
    requireArchive(
      (flags & ~0x80e) === 0 && (method === 0 || method === 8),
      'Encrypted or unsupported ZIP entry.',
    )
    requireArchive(
      cursor + 46 + nameLength + extraLength + commentLength <= directory.length,
      'Truncated ZIP directory entry.',
    )
    const nameBytes = directory.slice(cursor + 46, cursor + 46 + nameLength)
    const path = decodePath(nameBytes, flags)
    const key = path.normalize('NFC').replace(/\/$/, '')
    requireArchive(!paths.has(key), 'Duplicate ZIP entry path.')
    paths.add(key)
    checkExtra(directory.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength))
    total += expandedBytes
    requireArchive(
      expandedBytes <= EPUB_ARCHIVE_LIMITS.entryBytes &&
        total <= EPUB_ARCHIVE_LIMITS.expandedBytes &&
        expandedBytes <= Math.max(1, compressedBytes) * EPUB_ARCHIVE_LIMITS.compressionRatio,
      'ZIP expansion exceeds application limits.',
    )
    requireArchive(
      method !== 0 || compressedBytes === expandedBytes,
      'Stored ZIP entry size mismatch.',
    )
    requireArchive(!path.endsWith('/') || expandedBytes === 0, 'Directory entry contains data.')
    entries.push({
      path,
      method,
      flags,
      compressedBytes,
      expandedBytes,
      localOffset,
      nameBytes,
      crc: view.getUint32(cursor + 16, true),
      dataOffset: 0,
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  requireArchive(cursor === directory.length, 'Unexpected ZIP directory data.')
  entries.sort((a, b) => a.localOffset - b.localOffset)
  let expectedOffset = 0
  for (const entry of entries) {
    requireArchive(
      entry.localOffset === expectedOffset && expectedOffset + 30 <= directoryOffset,
      'Overlapping or inconsistent ZIP entries.',
    )
    const header = await read(entry.localOffset, 30)
    const local = new DataView(header.buffer)
    requireArchive(
      local.getUint32(0, true) === 0x04034b50 &&
        local.getUint16(4, true) <= 20 &&
        local.getUint16(6, true) === entry.flags &&
        local.getUint16(8, true) === entry.method,
      'ZIP local header mismatch.',
    )
    const nameLength = local.getUint16(26, true)
    const extraLength = local.getUint16(28, true)
    const metadata = await read(entry.localOffset + 30, nameLength + extraLength)
    requireArchive(
      equalBytes(metadata.subarray(0, nameLength), entry.nameBytes),
      'ZIP local filename mismatch.',
    )
    checkExtra(metadata.subarray(nameLength))
    entry.dataOffset = entry.localOffset + 30 + nameLength + extraLength
    expectedOffset = entry.dataOffset + entry.compressedBytes
    requireArchive(expectedOffset <= directoryOffset, 'ZIP data overlaps the directory.')
    if (entry.flags & 8) {
      const prefix = await read(expectedOffset, 4)
      const signed = new DataView(prefix.buffer).getUint32(0, true) === 0x08074b50
      const descriptor = await read(expectedOffset, signed ? 16 : 12)
      const data = new DataView(descriptor.buffer)
      const offset = signed ? 4 : 0
      requireArchive(
        data.getUint32(offset, true) === entry.crc &&
          data.getUint32(offset + 4, true) === entry.compressedBytes &&
          data.getUint32(offset + 8, true) === entry.expandedBytes,
        'ZIP data descriptor mismatch.',
      )
      expectedOffset += descriptor.length
    } else {
      requireArchive(
        local.getUint32(14, true) === entry.crc &&
          local.getUint32(18, true) === entry.compressedBytes &&
          local.getUint32(22, true) === entry.expandedBytes,
        'ZIP local size or checksum mismatch.',
      )
    }
    if (entry.path === 'mimetype') {
      requireArchive(
        entry.localOffset === 0 &&
          entry.method === 0 &&
          (entry.flags & ~0x800) === 0 &&
          extraLength === 0 &&
          entry.expandedBytes === 20,
        'Invalid EPUB mimetype entry.',
      )
      requireArchive(
        equalBytes(
          await read(entry.dataOffset, 20),
          new TextEncoder().encode('application/epub+zip'),
        ),
        'Invalid EPUB media type.',
      )
    }
  }
  requireArchive(expectedOffset === directoryOffset, 'Unexpected data before ZIP directory.')
  requireArchive(
    entries[0]?.path === 'mimetype' &&
      entries.some((entry) => entry.path === 'META-INF/container.xml' && entry.expandedBytes > 0),
    'EPUB container metadata is missing.',
  )
  signal?.throwIfAborted()
  return entries.map(({ path, method, compressedBytes, expandedBytes, dataOffset, crc }) => ({
    crc,
    path,
    method,
    compressedBytes,
    expandedBytes,
    dataOffset,
  }))
}
