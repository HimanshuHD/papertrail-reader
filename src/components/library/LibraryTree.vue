<script setup lang="ts">
import { computed } from 'vue'
import LibraryTreeNode from './LibraryTreeNode.vue'
import { buildLibraryTree } from '../../features/library/library-tree'
import type { DiscoveredDocument } from '../../features/library/discovery'

const props = defineProps<{
  documents: readonly DiscoveredDocument[]
  selectedId: string | null
}>()

defineEmits<{
  select: [id: string]
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
      @select="$emit('select', $event)"
    />
  </ul>
</template>
