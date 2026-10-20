# Portable annotation JSON

Open a PDF or EPUB, open **Annotations**, then choose **Export annotations (JSON)**. The download contains every saved highlight and note for that document, including entries hidden by search/color/note filters. Save note edits before exporting: unsaved editor drafts are excluded. Empty saved collections produce an empty `annotations` array. Export is unavailable while annotations are loading, saving or unavailable.

The browser decides how to save the download. “Download requested” does not mean the file was saved; cancelling the save dialog does not change annotations. A failed request leaves the reader and saved data intact and can be retried. Export runs locally without a network request. The downloaded file contains selected quotes and notes; it is the reader's portable copy of that content.

## Version 1 envelope

| Field                  | Meaning                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `schema`               | Literal `papertrail.annotations`                                               |
| `version`              | Export schema version, currently `1`                                           |
| `exportedAt`           | ISO 8601 UTC export-request time                                               |
| `document.format`      | `PDF` or `EPUB`                                                                |
| `document.fingerprint` | Existing verified `sha256-chunks-v1` content identity, independent of filename |
| `document.name`        | Display filename only, never a local path                                      |
| `document.title`       | Optional display title, if available                                           |
| `annotations`          | Complete committed collection; array order follows stored records              |

Each annotation retains `version: 2`, ID, color, plain-text note, creation/update timestamps (milliseconds since epoch), and its exact validated selector. These record and selector versions are independent of the export envelope version.

PDF selectors retain `version: 1`, `format`, and ordered segments with 1-based page, text offsets/exact quote/context, and normalized page rectangles. EPUB selectors retain `version: 1`, `format`, 0-based chapter, formatted/text mode, optional CFI, and text offsets/exact quote/context. CFI can be null; selectors are references rather than a guarantee that another reader can resolve them. Quote/note strings are text, never HTML instructions.

`prepareAnnotationExport` reuses the existing annotation document validator as a pure allowlisting step. It does not open IndexedDB or migrate stored data. Invalid identities, unsupported record/selector versions, duplicate IDs, mismatched formats, invalid geometry/text and existing count/character/rectangle limits reject the collection as a whole. Display basenames are bounded to 255 UTF-16 characters, titles to 1,000. Download filenames retain at most 80 Unicode code points from a sanitized basename with a fixed `papertrail-` prefix and `-annotations.json` suffix.

The export omits storage generations, file/directory handles, document bytes, absolute source paths, object URLs, passwords, reader settings, reading statistics and other documents' records. Unknown fields are not copied. The temporary validation generation is never exported. Serialization produces a detached snapshot, and the download adapter releases its temporary Blob URL after the browser can consume the click.

This increment is **export only**: there is no JSON importer, automatic restore or cloud sync. Environment-isolated storage and verified document ownership remain unchanged. Later consumers must explicitly support the envelope and selector versions rather than assume the export is an IndexedDB backup.
