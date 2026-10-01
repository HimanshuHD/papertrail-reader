<script setup lang="ts">
import { computed } from 'vue'
import type { ShellDocument } from '../../types/shell'
const props = defineProps<{ documents: readonly ShellDocument[]; selectedId: string }>()
defineEmits<{ select: [id: string]; close: [] }>()
const collections = computed(() => [
  ...new Set(props.documents.map((document) => document.collection)),
])
</script>

<template>
  <div class="p-5" @keydown.esc.stop="$emit('close')">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-semibold">Your library</h2>
      <span class="rounded-full border border-line px-2 py-1 text-xs text-muted">Sample</span>
    </div>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Explore the layout with demonstration titles. Press Escape from the library to close it.
    </p>
    <button
      type="button"
      disabled
      class="mt-5 min-h-11 w-full rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted"
    >
      Choose folder · coming soon
    </button>
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
      No folders or files have been accessed. Selection will be added in a later milestone.
    </p>
  </div>
</template>
