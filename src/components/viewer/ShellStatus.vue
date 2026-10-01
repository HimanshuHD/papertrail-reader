<script setup lang="ts">
import { computed } from 'vue'
import type { ShellViewState } from '../../types/shell'

const props = defineProps<{ state: ShellViewState }>()

const content = computed(() => {
  switch (props.state) {
    case 'empty':
      return {
        title: 'No documents selected',
        detail:
          'Choose a folder or PDF/EPUB files to begin. Nothing is accessed until you explicitly select it.',
      }
    case 'loading':
      return {
        title: 'Preparing your library',
        detail:
          'PaperTrail is preparing document information. Reader controls remain unavailable until this finishes.',
      }
    case 'error':
      return {
        title: 'PaperTrail could not prepare the library',
        detail:
          'Your documents were not changed. Retry the selection or use the available browser fallback.',
      }
    case 'demo':
      return {
        title: 'Demonstration workspace',
        detail:
          'Sample titles remain available for layout exploration. You can select and discover local PDF/EPUB files; the library tree and real reading are not active yet.',
      }
    default:
      return {
        title: 'PaperTrail workspace',
        detail: 'The workspace state is unavailable. No files have been accessed or changed.',
      }
  }
})
</script>

<template>
  <section
    class="border-b border-line bg-canvas px-5 py-3 text-sm sm:px-8"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
  >
    <p class="font-medium text-ink">{{ content.title }}</p>
    <p class="mt-1 leading-relaxed text-muted">{{ content.detail }}</p>
  </section>
</template>
