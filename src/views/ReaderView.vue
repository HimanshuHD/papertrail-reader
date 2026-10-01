<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ThemePicker from '../components/ThemePicker.vue'
import ReaderShell from '../components/layout/ReaderShell.vue'
import LibrarySidebar from '../components/library/LibrarySidebar.vue'
import ReaderToolbar from '../components/viewer/ReaderToolbar.vue'
import ReaderWorkspace from '../components/viewer/ReaderWorkspace.vue'
import type { ShellDocument } from '../types/shell'

const documents: readonly ShellDocument[] = [
  {
    id: 'welcome',
    title: 'Welcome to PaperTrail',
    format: 'PDF',
    collection: 'Getting started',
    detail: 'A sample reading space',
  },
  {
    id: 'field-notes',
    title: 'Notes from the trail',
    format: 'PDF',
    collection: 'Getting started',
    detail: 'An illustrative document',
  },
  {
    id: 'chapter',
    title: 'The next chapter',
    format: 'EPUB',
    collection: 'Books',
    detail: 'A sample book',
  },
]
const selectedId = ref('welcome')
const sidebarOpen = ref(true)
const selectedDocument = computed(
  () => documents.find((document) => document.id === selectedId.value) ?? documents[0]!,
)
function selectDocument(id: string) {
  if (documents.some((document) => document.id === id)) selectedId.value = id
}
</script>

<template>
  <main class="mx-auto w-full max-w-[1600px]" aria-label="PaperTrail application">
    <header
      class="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel px-5 py-4 sm:px-8"
    >
      <div class="flex flex-wrap items-center gap-4">
        <RouterLink to="/" class="text-xl font-bold tracking-tight" aria-label="PaperTrail home"
          >PaperTrail<span class="ml-2 text-xs font-normal text-muted">Home ↗</span></RouterLink
        >
        <span class="rounded-full border border-line px-3 py-1 text-xs text-muted"
          >Layout preview</span
        >
      </div>
      <ThemePicker />
    </header>
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-8"
    >
      <button
        type="button"
        aria-controls="document-sidebar"
        :aria-expanded="sidebarOpen"
        class="min-h-11 rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium"
        @click="sidebarOpen = !sidebarOpen"
      >
        {{ sidebarOpen ? 'Hide library' : 'Show library' }}
      </button>
      <p class="text-xs text-muted">Local-first reading · PDF &amp; EPUB</p>
    </div>
    <ReaderShell :sidebar-open="sidebarOpen">
      <template #sidebar
        ><LibrarySidebar :documents="documents" :selected-id="selectedId" @select="selectDocument"
      /></template>
      <template #toolbar><ReaderToolbar :document="selectedDocument" /></template>
      <ReaderWorkspace :document="selectedDocument" />
    </ReaderShell>
  </main>
</template>
