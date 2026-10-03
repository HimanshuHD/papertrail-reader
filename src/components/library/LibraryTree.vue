<script setup lang="ts">
import { computed } from 'vue'
import LibraryTreeNode from './LibraryTreeNode.vue'
import { buildLibraryTree } from '../../features/library/library-tree'
import type { LibraryDocumentMetadata } from '../../features/library/discovery'

const props = defineProps<{
  documents: readonly LibraryDocumentMetadata[]
  selectedId: string | null
  collapsedPaths?: readonly string[]
  disabled?: boolean
}>()

defineEmits<{
  select: [id: string]
  toggle: [path: string, expanded: boolean]
}>()

const nodes = computed(() => buildLibraryTree(props.documents))
</script>

<template>
  <ul class="space-y-1" aria-label="Local documents">
    <LibraryTreeNode
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :selected-id="selectedId"
      :collapsed-paths="collapsedPaths"
      :disabled="disabled"
      @toggle="(path, expanded) => $emit('toggle', path, expanded)"
      @select="$emit('select', $event)"
    />
  </ul>
</template>
