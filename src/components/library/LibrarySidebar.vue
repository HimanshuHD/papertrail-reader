<script setup lang="ts">
import { computed } from 'vue'
import LibrarySourcePicker from './LibrarySourcePicker.vue'
import type { BrowserLibrarySelection } from '../../features/library/browser-selection'
import type { ShellDocument } from '../../types/shell'

const props = defineProps<{
  documents: readonly ShellDocument[]
  selectedId: string
  selectionSummary: string
  discoverySummary: string
  discoveryBusy: boolean
  discoveryProblemCount: number
}>()

defineEmits<{
  select: [id: string]
  close: []
  librarySelection: [selection: BrowserLibrarySelection]
  cancelDiscovery: []
}>()

const collections = computed(() => [
  ...new Set(props.documents.map((document) => document.collection)),
])
</script>

<template>
  <div class="p-5" @keydown.esc.stop="$emit('close')">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-semibold">Your library</h2>
      <span class="rounded-full border border-line px-2 py-1 text-xs text-muted">Local</span>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Choose local documents explicitly, or explore the demonstration titles below. Press Escape
      from the library to close it.
    </p>

    <div class="mt-5">
      <LibrarySourcePicker
        :selection-summary="selectionSummary"
        @selected="$emit('librarySelection', $event)"
      />
    </div>

    <section class="mt-4 rounded-lg border border-line bg-canvas p-3" aria-labelledby="scan-title">
      <div class="flex items-center justify-between gap-3">
        <h3 id="scan-title" class="text-xs font-semibold tracking-wider text-muted uppercase">
          Discovery
        </h3>
        <button
          v-if="discoveryBusy"
          type="button"
          class="min-h-9 rounded-md border border-line px-3 py-1 text-xs font-medium"
          @click="$emit('cancelDiscovery')"
        >
          Cancel scan
        </button>
      </div>
      <p class="mt-2 text-xs leading-relaxed text-muted" role="status" aria-live="polite">
        {{ discoverySummary }}
      </p>
      <p v-if="discoveryProblemCount > 0" class="mt-2 text-xs leading-relaxed text-muted">
        {{ discoveryProblemCount }} recoverable access issue(s) recorded. Other readable documents
        remain available for the next library step.
      </p>
    </section>

    <nav class="mt-6 space-y-5" aria-label="Demonstration documents">
      <section v-for="collection in collections" :key="collection">
        <h3 class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
          {{ collection }}
        </h3>
        <ul class="space-y-1">
          <li
            v-for="document in documents.filter((item) => item.collection === collection)"
            :key="document.id"
          >
            <button
              type="button"
              :aria-pressed="selectedId === document.id"
              :class="[
                'flex min-h-14 w-full items-start gap-3 rounded-lg border p-3 text-left',
                selectedId === document.id
                  ? 'border-brand bg-canvas'
                  : 'border-transparent hover:bg-canvas',
              ]"
              @click="$emit('select', document.id)"
            >
              <span
                class="mt-0.5 rounded border border-line px-1 py-0.5 text-[10px] font-bold text-brand"
                >{{ document.format }}</span
              >
              <span class="min-w-0 break-words text-sm"
                ><span class="block font-medium">{{ document.title }}</span
                ><span class="mt-1 block text-xs text-muted">{{ document.detail }}</span></span
              >
            </button>
          </li>
        </ul>
      </section>
    </nav>
    <p class="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">
      PaperTrail only receives files you explicitly choose. Discovery now identifies supported
      documents; directory-tree presentation and refresh UI remain the next milestone.
    </p>
  </div>
</template>
