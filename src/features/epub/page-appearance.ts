/** Adapt authored chapter colors in dark mode while retaining layout and images. */
export function bindEpubPageAppearance(doc: Document, dark: boolean) {
  const style = doc.createElement('style')
  doc.head.append(style)
  function set(value: boolean) {
    style.textContent = value
      ? `html,body { background-color:#111b22!important; color:#e4edf3!important; color-scheme:dark; }
      body :where(*) { color:inherit!important; background-color:transparent!important; }
      ::highlight(papertrail-yellow),::highlight(papertrail-green),::highlight(papertrail-blue),::highlight(papertrail-pink) { color:#173449; }`
      : ''
  }
  set(dark)
  return { set, dispose: () => style.remove() }
}
