<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LibraryTreeNode } from '../../features/library/library-tree'

defineOptions({ name: 'LibraryTreeNode' })

const props = defineProps<{
  node: LibraryTreeNode
  selectedId: string | null
}>()

defineEmits<{
  select: [id: string]
}>()

const expanded = ref(true)
const label = computed(() =>
  props.node.kind === 'document'
    ? props.node.document.title?.trim() || props.node.document.name
    : props.node.name,
)
</script>

<template>
  <li>
    <template v-if="node.kind === 'folder'">
      <button
        type="button"
        class="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="w-4 shrink-0 text-center text-muted" aria-hidden="true">{{
          expanded ? '▾' : '▸'
        }}</span>
        <span class="min-w-0 flex-1 truncate font-medium" :title="node.name">{{ node.name }}</span>
        <span class="shrink-0 text-[11px] text-muted">{{ node.documentCount }}</span>
      </button>

      <ul v-if="expanded" class="ml-3 border-l border-line pl-2">
        <LibraryTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :selected-id="selectedId"
          @select="$emit('select', $event)"
        />
      </ul>
    </template>

    <button
      v-else
      type="button"
      :aria-pressed="selectedId === node.document.id"
      :title="label"
      :aria-label="`${node.document.format}: ${label}`"
      :class="[
        'flex min-h-11 w-full items-center gap-2 rounded-md border px-2 py-2 text-left',
        selectedId === node.document.id
          ? 'border-brand bg-canvas'
          : 'border-transparent hover:bg-canvas',
      ]"
      @click="$emit('select', node.document.id)"
    >
      <span
        class="mt-0.5 shrink-0 rounded border border-line px-1 py-0.5 text-[10px] font-bold text-brand"
        >{{ node.document.format }}</span
      >
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ label }}</span>
    </button>
  </li>
</template>
