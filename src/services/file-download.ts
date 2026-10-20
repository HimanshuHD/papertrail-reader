/** Request a local JSON download; success means requested, not that the user saved the file. */
export function downloadJson(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    link.hidden = true
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    // Give the browser a task to consume the URL before releasing its temporary backing Blob.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
