import { diagnostics } from '../features/diagnostics/recorder'
/** Request a local JSON download; success means requested, not that the user saved the file. */
export function downloadJson(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  if (__READER_DIAGNOSTICS__) diagnostics.resources(link, { blobURLs: 1 })
  try {
    link.href = url
    link.download = filename
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // Give the browser a task to consume the URL before releasing its temporary backing Blob.
    setTimeout(() => {
      URL.revokeObjectURL(url)
      if (__READER_DIAGNOSTICS__) diagnostics.release(link)
    }, 0)
  }
}
