# Annotations and insights acceptance evidence (#145)

Candidate `2ed4f36688686273f216cf70ec7198de5d6d7267`; tested merge checkout `b07558632b8d501dcd0004566789b402c4738e38`. [Browser E2E 37568965714](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37568965714): 192 passed, zero failed/flaky, eight intentional duplicate long-PDF/native-directory skips at 320/375/768/1024px; both cases execute at 1440px. Frontend CI 37568950850 passed. Chromium 153.0.8010.12, Linux, Node v24.21.0. Widths: 320/375/768/1024/1440px.

`environment.json` records exact identity; `outcomes.json` retains every case outcome and retry. Four original desktop Reading insights screenshots retain inspected PDF/EPUB light/dark views. Annotation/note screenshots were also inspected in the run artifact. This is a scoped visual review, not every interaction permutation.

Full report artifact 11460580564 and compact artifact 11460157243 expire 14 October 2026. These retained files do not depend on artifact expiry. Remaining native/visual/other-browser matrix cases are split into #161 under #28/#16, milestone 6; no unexecuted case is claimed as passed. Feature implementation and this Chromium gate are accepted for #160 owner merge.
