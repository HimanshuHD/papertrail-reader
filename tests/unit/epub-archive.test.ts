import { Blob } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import {
  EPUB_ARCHIVE_LIMITS,
  preflightEpubArchive,
} from '../../src/features/epub/archive-preflight'

interface FixtureEntry {
  path: string
  body?: string
  method?: number
  flags?: number
  expanded?: number
  descriptor?: boolean
  localPath?: string
  extra?: Uint8Array
  unsignedDescriptor?: boolean
}

function archive(
  entries: FixtureEntry[] = [
    { path: 'mimetype', body: 'application/epub+zip' },
    { path: 'META-INF/container.xml', body: '<container />' },
  ],
) {
  const locals: Uint8Array[] = []
  const directories: Uint8Array[] = []
  let offset = 0
  for (const item of entries) {
    const name = new TextEncoder().encode(item.path)
    const localName = new TextEncoder().encode(item.localPath ?? item.path)
    const body = new TextEncoder().encode(item.body ?? '')
    const flags = item.flags ?? (item.descriptor ? 8 : 0)
    const expanded = item.expanded ?? body.length
    const extra = item.extra ?? new Uint8Array()
    const descriptorLength = item.descriptor ? (item.unsignedDescriptor ? 12 : 16) : 0
    const local = new Uint8Array(
      30 + localName.length + extra.length + body.length + descriptorLength,
    )
    const l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true)
    l.setUint16(4, 20, true)
    l.setUint16(6, flags, true)
    l.setUint16(8, item.method ?? 0, true)
    if (!item.descriptor) {
      l.setUint32(18, body.length, true)
      l.setUint32(22, expanded, true)
    }
    l.setUint16(26, localName.length, true)
    l.setUint16(28, extra.length, true)
    local.set(localName, 30)
    local.set(extra, 30 + localName.length)
    local.set(body, 30 + localName.length + extra.length)
    if (item.descriptor) {
      let d = 30 + localName.length + extra.length + body.length
      if (!item.unsignedDescriptor) {
        l.setUint32(d, 0x08074b50, true)
        d += 4
      }
      l.setUint32(d + 4, body.length, true)
      l.setUint32(d + 8, expanded, true)
    }
    const central = new Uint8Array(46 + name.length + extra.length)
    const c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, flags, true)
    c.setUint16(10, item.method ?? 0, true)
    c.setUint32(20, body.length, true)
    c.setUint32(24, expanded, true)
    c.setUint16(28, name.length, true)
    c.setUint16(30, extra.length, true)
    c.setUint32(42, offset, true)
    central.set(name, 46)
    central.set(extra, 46 + name.length)
    locals.push(local)
    directories.push(central)
    offset += local.length
  }
  const directorySize = directories.reduce((sum, entry) => sum + entry.length, 0)
  const result = new Uint8Array(offset + directorySize + 22)
  let cursor = 0
  for (const block of [...locals, ...directories]) {
    result.set(block, cursor)
    cursor += block.length
  }
  const end = new DataView(result.buffer, cursor)
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, directorySize, true)
  end.setUint32(16, offset, true)
  return result
}

const mime = { path: 'mimetype', body: 'application/epub+zip' }
const container = { path: 'META-INF/container.xml', body: '<container />' }
const blob = (bytes: Uint8Array) => new Blob([bytes]) as unknown as globalThis.Blob

describe('local EPUB archive preflight', () => {
  it('accepts unsigned descriptors and explicitly UTF-8 names', async () => {
    const entries = await preflightEpubArchive(
      blob(
        archive([
          mime,
          container,
          {
            path: 'OPS/हिन्दी.xhtml',
            flags: 0x808,
            body: 'text',
            descriptor: true,
            unsignedDescriptor: true,
          },
        ]),
      ),
    )
    expect(entries[2]?.path).toBe('OPS/हिन्दी.xhtml')
  })

  it.each([
    new Uint8Array([1, 0, 0, 0]),
    new Uint8Array([0x75, 0x70, 0, 0]),
    new Uint8Array([2, 0, 10, 0]),
  ])('rejects ZIP64, alternate names and truncated extra metadata', async (extra) => {
    await expect(
      preflightEpubArchive(blob(archive([mime, { ...container, extra }]))),
    ).rejects.toThrow()
  })

  it('rejects overlapping local records and aggregate declared expansion', async () => {
    const bytes = archive()
    const end = new DataView(bytes.buffer, bytes.length - 22)
    const centralOffset = end.getUint32(16, true)
    new DataView(bytes.buffer).setUint32(centralOffset + 46 + 8 + 42, 0, true)
    await expect(preflightEpubArchive(blob(bytes))).rejects.toThrow('inconsistent')
    const resources = Array.from({ length: 9 }, (_, index) => ({
      path: `OPS/${index}`,
      method: 8,
      body: 'x'.repeat(170000),
      expanded: 32 * 1024 * 1024,
    }))
    await expect(
      preflightEpubArchive(blob(archive([mime, container, ...resources]))),
    ).rejects.toThrow('expansion')
  })

  it('does not continue reading after cancellation during an asynchronous read', async () => {
    const file = blob(archive())
    const controller = new AbortController()
    const original = file.slice.bind(file)
    const read = vi.spyOn(file, 'slice').mockImplementation((start, end) => {
      controller.abort()
      return original(start, end)
    })
    await expect(preflightEpubArchive(file, controller.signal)).rejects.toThrow()
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('accepts stored resources and signed descriptors without reading the whole book', async () => {
    const file = blob(
      archive([
        mime,
        container,
        { path: 'OPS/chapter.xhtml', body: 'x'.repeat(100000), descriptor: true },
      ]),
    )
    const read = vi.spyOn(file, 'slice')
    const entries = await preflightEpubArchive(file)
    expect(entries.map((entry) => entry.path)).toEqual([
      'mimetype',
      'META-INF/container.xml',
      'OPS/chapter.xhtml',
    ])
    expect(entries[2]?.expandedBytes).toBe(100000)
    expect(read.mock.calls.every(([start = 0, end = 0]) => end - start <= 65557)).toBe(true)
  })

  it.each([
    '../chapter.xhtml',
    '/chapter.xhtml',
    'OPS/../chapter.xhtml',
    'OPS\\chapter.xhtml',
    'https://host/chapter',
    'OPS/%2e%2e/file',
    'OPS//chapter',
    'OPS/./chapter',
    'OPS/a\u0000b',
  ])('rejects unsafe path %s', async (path) => {
    await expect(preflightEpubArchive(blob(archive([mime, container, { path }])))).rejects.toThrow(
      'Unsafe',
    )
  })

  it.each([
    [mime, container, container],
    [{ ...mime, body: 'application/otherzip' }, container],
    [container, mime],
    [mime],
    [mime, { ...container, body: '' }],
    [mime, container, { path: 'OPS/a', localPath: 'OPS/b' }],
    [mime, { ...container, flags: 1 }],
    [mime, { ...container, method: 9 }],
    [mime, { ...container, method: 8, expanded: EPUB_ARCHIVE_LIMITS.entryBytes + 1 }],
    [mime, { ...container, method: 8, expanded: 10000 }],
  ])(
    'rejects invalid identities, unsupported entries and declared expansion',
    async (...entries) => {
      await expect(preflightEpubArchive(blob(archive(entries)))).rejects.toThrow()
    },
  )

  it('rejects truncated, multidisk, inconsistent and excessive directories', async () => {
    const bytes = archive()
    await expect(preflightEpubArchive(blob(bytes.slice(0, -1)))).rejects.toThrow()
    for (const [offset, value, width] of [
      [4, 1, 2],
      [10, 65535, 2],
      [12, 0xffffffff, 4],
      [16, 0xffffffff, 4],
    ]) {
      const changed = bytes.slice()
      const end = new DataView(changed.buffer, changed.length - 22)
      if (width === 2) end.setUint16(offset!, value!, true)
      else end.setUint32(offset!, value!, true)
      await expect(preflightEpubArchive(blob(changed))).rejects.toThrow()
    }
  })

  it('rejects disagreement between local sizes, descriptors and central metadata', async () => {
    const bytes = archive([mime, container, { path: 'OPS/a', body: 'text', descriptor: true }])
    const entry = (await preflightEpubArchive(blob(bytes)))[2]!
    const changed = bytes.slice()
    new DataView(changed.buffer).setUint32(entry.dataOffset + 4 + 8, 999, true)
    await expect(preflightEpubArchive(blob(changed))).rejects.toThrow('descriptor mismatch')
    new DataView(bytes.buffer).setUint32(18, 21, true)
    await expect(preflightEpubArchive(blob(bytes))).rejects.toThrow('size or checksum mismatch')
  })

  it('cancels before reads and rejects oversized input without reading it', async () => {
    const file = blob(archive())
    const read = vi.spyOn(file, 'slice')
    const controller = new AbortController()
    controller.abort()
    await expect(preflightEpubArchive(file, controller.signal)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
    await expect(
      preflightEpubArchive({
        size: EPUB_ARCHIVE_LIMITS.archiveBytes + 1,
        slice: read,
      } as unknown as globalThis.Blob),
    ).rejects.toThrow('size')
    expect(read).not.toHaveBeenCalled()
  })
})
