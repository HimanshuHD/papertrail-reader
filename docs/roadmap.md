# Product roadmap

Parent: [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1). Full detail: [roadmap PDF](PaperTrail-Complete-Project-Roadmap.pdf).

## M0 - Repository and engineering foundation

- [x] [#2 [M0] Repository documentation and issue tracking](https://github.com/HimanshuHD/papertrail-reader/issues/2)
- [ ] [#3 [M0] Bootstrap Vue 3, Vite and TypeScript](https://github.com/HimanshuHD/papertrail-reader/issues/3)
- [ ] [#4 [M0] Integrate Tauri 2 desktop shell](https://github.com/HimanshuHD/papertrail-reader/issues/4)
- [ ] [#5 [M0] Configure code quality, tests and GitHub Actions](https://github.com/HimanshuHD/papertrail-reader/issues/5)

## M1 - UI foundation and application shell

- [ ] [#6 [M1] Design tokens, themes and application state](https://github.com/HimanshuHD/papertrail-reader/issues/6)
- [ ] [#7 [M1] Split reader layout and accessible app shell](https://github.com/HimanshuHD/papertrail-reader/issues/7)

## M2 - Local filesystem integration

- [ ] [#8 [M2] Native folder selection and scoped file access](https://github.com/HimanshuHD/papertrail-reader/issues/8)
- [ ] [#9 [M2] Recursive document scanner and directory tree](https://github.com/HimanshuHD/papertrail-reader/issues/9)

## M3 - PDF reader

- [ ] [#10 [M3] PDF.js reader, navigation and zoom](https://github.com/HimanshuHD/papertrail-reader/issues/10)
- [ ] [#11 [M3] PDF search, contents and reader shortcuts](https://github.com/HimanshuHD/papertrail-reader/issues/11)

## M4 - EPUB reader

- [ ] [#12 [M4] EPUB reader and reflow controls](https://github.com/HimanshuHD/papertrail-reader/issues/12)

## M5 - Reading productivity

- [ ] [#13 [M5] Stable document identity, reading positions and bookmarks](https://github.com/HimanshuHD/papertrail-reader/issues/13)
- [ ] [#14 [M5] Recent documents and library search](https://github.com/HimanshuHD/papertrail-reader/issues/14)
- [ ] [#15 [M5] Annotations, highlights and reading statistics](https://github.com/HimanshuHD/papertrail-reader/issues/15)

## M6 - Performance and reliability

- [ ] [#16 [M6] Performance, reliability and document security verification](https://github.com/HimanshuHD/papertrail-reader/issues/16)

## M7 - Multi-document experience and release

- [ ] [#17 [M7] Document tabs and session restoration](https://github.com/HimanshuHD/papertrail-reader/issues/17)
- [ ] [#18 [M7] Optional split view and annotation export](https://github.com/HimanshuHD/papertrail-reader/issues/18)
- [ ] [#19 [M7] Desktop packaging and first release](https://github.com/HimanshuHD/papertrail-reader/issues/19)

## Release scope

0.1: M0-M4 plus saved positions/bookmarks (#13). Complete reliability checks needed for the released scope; remaining M5-M7 features stay tracked. #19 covers packaging for 0.1 and subsequent releases.

## Format behavior

PDF uses fixed pages and zoom. EPUB uses CFI/location progress and reflow controls. Image-only PDF text search requires OCR, which is outside 0.1. DRM-protected EPUB support is outside the initial scope.
