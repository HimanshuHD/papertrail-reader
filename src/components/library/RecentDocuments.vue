<script setup lang="ts">
import { nextTick, ref } from 'vue'
import UiIcon from '../UiIcon.vue'
import type { RecentDocument } from '../../services/recent-documents'

defineProps<{ documents: readonly RecentDocument[]; message?: string; busy?: boolean }>()
const emit = defineEmits<{
  open: [entry: RecentDocument]
  remove: [id: string]
  clear: []
  retry: []
}>()
const expanded = ref(true)
const toggle = ref<HTMLButtonElement | null>(null)
async function forget(id?: string) {
  if (id) emit('remove', id)
  else emit('clear')
  await nextTick()
  toggle.value?.focus()
}
</script>
<template>
  <section class="mb-4" aria-labelledby="recent-title">
    <h3>
      <button
        id="recent-title"
        ref="toggle"
        type="button"
        class="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-medium hover:bg-canvas"
        :aria-expanded="expanded"
        aria-controls="recent-documents"
        @click="expanded = !expanded"
      >
        <UiIcon name="clock" class="shrink-0 text-muted" />
        <span class="flex-1">Recent</span>
        <span class="text-muted" data-testid="recent-count">{{ documents.length }}</span>
      </button>
    </h3>
    <div v-show="expanded" id="recent-documents" class="space-y-2 pt-2">
      <button
        v-if="documents.length"
        type="button"
        :disabled="busy"
        class="px-2 text-xs text-brand"
        @click="forget()"
      >
        Clear recent history
      </button>
      <ul class="space-y-2">
        <li v-for="entry in documents" :key="entry.id" class="flex min-w-0 items-start gap-2">
          <button
            type="button"
            :disabled="busy"
            class="min-w-0 flex-1 rounded border border-line px-2 py-2 text-left text-xs hover:border-brand"
            :aria-label="`Open recent PDF ${entry.name}`"
            @click="$emit('open', entry)"
          >
            <span class="block break-words font-medium">{{ entry.title || entry.name }}</span
            ><span class="block break-words text-muted">{{ entry.relativePath }}</span>
          </button>
          <button
            type="button"
            :disabled="busy"
            class="rounded p-2 text-muted hover:text-brand"
            :aria-label="`Remove recent PDF ${entry.name}`"
            @click="forget(entry.id)"
          >
            <UiIcon name="close" class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
    <p v-if="message" role="status" class="mt-2 text-xs text-muted">{{ message }}</p>
    <button
      v-if="message"
      type="button"
      :disabled="busy"
      class="mt-2 text-xs text-brand"
      @click="$emit('retry')"
    >
      Retry recent history
    </button>
  </section>
</template>
