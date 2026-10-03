<script setup lang="ts">
import type { LibraryDocumentMetadata } from '../../features/library/discovery'

defineProps<{
  selectedDocument: LibraryDocumentMetadata | null
  hasLibrarySelection: boolean
}>()
</script>

<template>
  <section class="reader-welcome min-w-0 px-4 py-6 sm:px-8 sm:py-9" aria-labelledby="reader-title">
    <article
      v-if="selectedDocument?.format === 'PDF'"
      class="welcome-page rounded-card border border-line bg-panel p-6 shadow-xl"
    >
      <p class="text-xs font-semibold text-brand">Saved document</p>
      <h2 id="reader-title" class="mt-3 break-words font-serif text-3xl">
        {{ selectedDocument.title || selectedDocument.name }}
      </h2>
      <p class="mt-4 text-sm text-muted">
        Reconnect your library or reselect the source to resume this PDF. Your reading position is
        saved separately.
      </p>
    </article>
    <div v-else-if="selectedDocument?.format === 'EPUB'" class="document-stage">
      <article class="welcome-page epub-state rounded-card border border-line bg-panel shadow-xl">
        <div class="flex items-center justify-between gap-4">
          <p class="text-xs font-semibold tracking-[0.18em] text-brand uppercase">EPUB document</p>
          <span class="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted"
            >Roadmap 2</span
          >
        </div>

        <div class="my-7 h-px bg-line"></div>

        <p class="text-sm text-muted">Selected from your local library</p>
        <h2
          id="reader-title"
          class="mt-3 break-words font-serif text-3xl leading-tight sm:text-4xl"
        >
          {{ selectedDocument.name }}
        </h2>
        <p class="mt-6 max-w-xl leading-relaxed text-muted">
          EPUB reading is not available in this release yet. The file stays in your library, and you
          can open any PDF now without changing your selection source.
        </p>

        <div class="mt-8 rounded-xl border border-line bg-canvas px-4 py-4">
          <p class="text-sm font-medium">Coming after the first release</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            Reflowable EPUB reading and typography controls are planned in PaperTrail Roadmap 2.
          </p>
        </div>
      </article>
    </div>

    <div v-else class="document-stage">
      <article class="welcome-page rounded-card border border-line bg-panel shadow-xl">
        <div class="flex items-center justify-between gap-4">
          <p class="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            PaperTrail reader
          </p>
          <span class="reader-ready-dot inline-flex items-center gap-2 text-[11px] text-muted">
            <span class="h-2 w-2 rounded-full bg-brand" aria-hidden="true"></span>
            Ready when you are
          </span>
        </div>

        <div class="my-7 h-px bg-line"></div>

        <p class="text-sm font-medium text-muted">A quiet space for your next chapter</p>
        <h2 id="reader-title" class="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
          Welcome to PaperTrail
        </h2>
        <p class="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          Your documents will have room to breathe here. The library sits beside your reading space,
          with controls close at hand and an appearance you can make your own.
        </p>

        <div class="mt-8 grid gap-3 sm:grid-cols-3" aria-label="PaperTrail workspace highlights">
          <div class="feature-card rounded-xl border border-line bg-canvas px-4 py-4">
            <p class="text-xs font-semibold tracking-wider text-brand uppercase">Library</p>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              Folders and files stay within reach.
            </p>
          </div>
          <div class="feature-card rounded-xl border border-line bg-canvas px-4 py-4">
            <p class="text-xs font-semibold tracking-wider text-brand uppercase">Reading space</p>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              PDFs open on a focused reader canvas.
            </p>
          </div>
          <div class="feature-card rounded-xl border border-line bg-canvas px-4 py-4">
            <p class="text-xs font-semibold tracking-wider text-brand uppercase">Appearance</p>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              Choose the theme that feels right.
            </p>
          </div>
        </div>

        <div
          class="next-step mt-8 flex items-start gap-3 rounded-xl border border-line px-4 py-4 sm:items-center"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-xl font-light text-brand"
            aria-hidden="true"
            >+</span
          >
          <div>
            <p class="text-sm font-semibold">
              {{
                hasLibrarySelection
                  ? 'Choose a document from the library'
                  : 'Add your first document'
              }}
            </p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              {{
                hasLibrarySelection
                  ? 'Select a PDF on the left to open it in this reading space.'
                  : 'Use the + button in Library to add a folder or select PDF / EPUB files.'
              }}
            </p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.reader-welcome {
  position: relative;
  display: grid;
  min-height: 100%;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 18% 14%,
      color-mix(in srgb, var(--pt-brand) 14%, transparent),
      transparent 34%
    ),
    radial-gradient(
      circle at 88% 82%,
      color-mix(in srgb, var(--pt-brand) 8%, transparent),
      transparent 30%
    ),
    var(--pt-canvas);
}
.reader-welcome::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--pt-line) 38%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--pt-line) 38%, transparent) 1px, transparent 1px);
  background-size: 28px 28px;
  content: '';
  mask-image: radial-gradient(circle at center, black, transparent 74%);
  opacity: 0.55;
  pointer-events: none;
}
.document-stage {
  position: relative;
  width: min(52rem, 100%);
}
.document-stage::before,
.document-stage::after {
  position: absolute;
  inset: 0.7rem 1.2rem -0.7rem;
  border: 1px solid var(--pt-line);
  border-radius: var(--radius-card);
  background: var(--pt-panel);
  content: '';
  opacity: 0.5;
  pointer-events: none;
}
.document-stage::before {
  transform: rotate(-1deg);
}
.document-stage::after {
  inset: 1.15rem 1.8rem -1.15rem;
  transform: rotate(1.2deg);
  opacity: 0.28;
}
.welcome-page {
  position: relative;
  z-index: 1;
  padding: clamp(1.5rem, 4vw, 3.25rem);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}
.epub-state {
  max-width: 42rem;
  margin-inline: auto;
}
.feature-card,
.next-step {
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}
.next-step {
  background: color-mix(in srgb, var(--pt-brand) 6%, var(--pt-panel));
}
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .welcome-page:hover {
    transform: translateY(-2px);
    box-shadow: 0 22px 56px rgb(0 0 0 / 14%);
  }
  .feature-card:hover {
    transform: translateY(-2px);
    border-color: var(--pt-brand);
  }
  .next-step:hover {
    border-color: var(--pt-brand);
  }
}
@media (prefers-reduced-motion: reduce) {
  .welcome-page,
  .feature-card,
  .next-step {
    transition: none;
  }
}
@media (max-width: 520px) {
  .reader-ready-dot {
    display: none;
  }
  .document-stage::before,
  .document-stage::after {
    inset-inline: 0.5rem;
  }
}
</style>
