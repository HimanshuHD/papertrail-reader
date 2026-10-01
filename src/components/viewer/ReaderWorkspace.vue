<script setup lang="ts">
import type { ShellDocument } from '../../types/shell'
defineProps<{ document: ShellDocument }>()
</script>

<template>
  <section class="min-w-0 px-4 py-6 sm:px-8 sm:py-8" aria-labelledby="reader-title">
    <div class="mx-auto max-w-3xl">
      <p
        class="mb-5 rounded-lg border border-line bg-panel px-4 py-3 text-sm leading-relaxed text-muted"
      >
        <strong class="text-ink">Layout preview.</strong> These titles and pages are samples. File
        access and {{ document.format }} reading are not available yet.
      </p>
      <article
        class="sample-page rounded-card border border-line bg-panel px-6 py-10 shadow-sm sm:px-12 sm:py-14"
        aria-label="Illustrative sample page"
      >
        <p class="text-xs font-semibold tracking-widest text-brand uppercase">
          PaperTrail / demonstration
        </p>
        <div class="my-8 h-px bg-line"></div>
        <p class="text-sm text-muted">A quiet space for your next chapter</p>
        <h3 class="mt-3 break-words font-serif text-3xl leading-tight sm:text-4xl">
          {{ document.title }}
        </h3>
        <p class="mt-6 max-w-xl leading-loose text-muted">
          Your documents will have room to breathe here. The library sits beside your reading space,
          with controls close at hand and an appearance you can make your own.
        </p>
        <p class="mt-5 max-w-xl leading-loose text-muted">
          This illustrative page shows the workspace layout. Choosing a sample title changes its
          heading only; it does not open a document.
        </p>
        <div class="mt-10 border-t border-line pt-5 text-xs text-muted">
          Sample content · {{ document.format }} reader integration is planned
        </div>
      </article>
      <p class="mt-5 text-center text-xs text-muted">
        Navigation, progress and {{ document.format === 'PDF' ? 'zoom' : 'typography' }} controls
        will arrive with the reader engine.
      </p>
    </div>
  </section>
</template>

<style scoped>
.sample-page {
  min-height: 440px;
}
</style>
