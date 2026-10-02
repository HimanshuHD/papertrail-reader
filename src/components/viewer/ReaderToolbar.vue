<script setup lang="ts">
import type { ShellDocument } from '../../types/shell'
defineProps<{ document: ShellDocument }>()
</script>

<template>
  <header
    class="sample-toolbar flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-8"
  >
    <div class="min-w-0 flex-1 basis-full sm:basis-auto">
      <p class="text-xs font-semibold tracking-wider text-brand uppercase">
        {{ document.format }} · sample workspace
      </p>
      <h2 id="reader-title" class="mt-1 break-words text-lg font-semibold">{{ document.title }}</h2>
    </div>
    <div
      class="sample-toolbar flex flex-wrap items-center gap-2"
      aria-label="Planned reader controls"
    >
      <button
        type="button"
        disabled
        class="rounded-lg border border-line px-3 py-2 text-sm text-muted"
      >
        {{ document.format === 'PDF' ? 'Zoom − / +' : 'Font size − / +' }}
      </button>
      <button
        type="button"
        disabled
        class="rounded-lg border border-line px-3 py-2 text-sm text-muted"
      >
        Contents
      </button>
    </div>
  </header>
</template>
