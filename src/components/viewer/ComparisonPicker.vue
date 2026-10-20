<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import IconButton from '../IconButton.vue'
import FloatingPopover from '../FloatingPopover.vue'
import type { DocumentSession } from '../../features/reader/document-sessions'
const props = defineProps<{ tabs: readonly DocumentSession[]; selectedId: string | null }>()
const emit = defineEmits<{ compare: [id: string] }>()
const open = ref(false)
const anchor = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const id = useId()
const eligible = (tab: DocumentSession) =>
  !!tab.fingerprint && !['closed', 'reconnect'].includes(tab.phase)
const choices = computed(() =>
  props.tabs.filter((tab) => tab.id !== props.selectedId && eligible(tab)),
)
const enabled = computed(
  () =>
    props.tabs.some((tab) => tab.id === props.selectedId && eligible(tab)) &&
    choices.value.length > 0,
)
async function toggle(event: MouseEvent) {
  anchor.value = event.currentTarget as HTMLElement
  open.value = !open.value
  await nextTick()
  if (open.value) menu.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
function choose(id: string) {
  open.value = false
  emit('compare', id)
}
watch(
  () => [props.selectedId, enabled.value],
  () => {
    open.value = false
  },
)
function leaves(event: FocusEvent) {
  if (
    event.relatedTarget &&
    !menu.value?.contains(event.relatedTarget as Node) &&
    !anchor.value?.contains(event.relatedTarget as Node)
  )
    open.value = false
}
</script>
<template>
  <div v-if="tabs.length > 1" class="comparison-picker shrink-0">
    <IconButton
      label="Compare documents"
      icon="compare"
      :disabled="!enabled"
      :aria-expanded="open"
      :aria-controls="open ? id : undefined"
      aria-haspopup="dialog"
      @click="toggle"
    />
    <FloatingPopover v-if="open" :anchor="anchor" compact @close="open = false">
      <div
        :id="id"
        ref="menu"
        role="dialog"
        aria-label="Choose a document to compare"
        @focusout="leaves"
      >
        <p class="mb-2 text-xs text-muted">Compare with another open document</p>
        <button
          v-for="tab in choices"
          :key="tab.id"
          type="button"
          class="pt-list-entry block w-full rounded-md p-2 text-left text-sm break-words"
          @click="choose(tab.id)"
        >
          Compare with {{ tab.title }}
        </button>
      </div>
    </FloatingPopover>
  </div>
</template>
