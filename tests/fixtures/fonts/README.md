# Generated font fixtures

`generated-font.ts` contains geometric ASCII glyphs authored for the test suite,
not a bundled third-party typeface or a font extracted from a book. Each non-space
glyph is a rectangle with a 1,400-unit advance on a 1,000-unit em. Thus `iii` at
20px occupies 84px and differs clearly from the fallback system font.

Regenerate with Python, FontTools and Brotli installed:

```sh
python tests/fixtures/fonts/generate.py
npx prettier --write tests/fixtures/fonts/generated-font.ts
```

TTF, CFF OpenType, WOFF and WOFF2 share the same intended metrics. A deterministic
head timestamp is used. FontTools/Brotli are regeneration tools, not application
or CI runtime dependencies. Browser font decoding/metrics are checked separately
from container-admission unit tests.
