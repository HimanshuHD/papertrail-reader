<script setup lang="ts">
import type { EpubContentsEntry } from '../../features/epub/navigation'
defineProps<{ entries: readonly EpubContentsEntry[]; currentId?: string; busy: boolean }>()
defineEmits<{ select: [entry: EpubContentsEntry] }>()
</script>

<template>
  <ul class="epub-toc-list">
    <li v-for="entry in entries" :key="entry.id">
      <button
        v-if="entry.chapter !== null"
        type="button"
        class="epub-toc-link"
        :disabled="busy"
        :aria-current="entry.id === currentId ? 'location' : undefined"
        @click="$emit('select', entry)"
      >
        {{ entry.label }}
      </button>
      <span v-else class="epub-toc-group">{{ entry.label }}</span>
      <EpubContentsList
        v-if="entry.children.length"
        :entries="entry.children"
        :current-id="currentId"
        :busy="busy"
        @select="$emit('select', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.epub-toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.epub-toc-list .epub-toc-list {
  padding-inline-start: 0.6rem;
}
.epub-toc-link,
.epub-toc-group {
  display: block;
  width: 100%;
  text-align: start;
  padding: 0.45rem;
  overflow-wrap: anywhere;
}
.epub-toc-link[aria-current] {
  font-weight: 700;
  text-decoration: underline;
}
.epub-toc-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.epub-toc-link:disabled {
  cursor: wait;
}
</style>
