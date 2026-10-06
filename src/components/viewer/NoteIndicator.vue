<script setup lang="ts">
import { ref, useId } from 'vue'
import UiIcon from '../UiIcon.vue'
import FloatingPopover from '../FloatingPopover.vue'
defineProps<{ note: string; label: string; highlighted?: boolean }>()
const emit = defineEmits<{ activate: [] }>()
const trigger = ref<HTMLButtonElement | null>(null)
const preview = ref(false)
const tooltipId = useId()
function activate() {
  preview.value = false
  emit('activate')
}
</script>
<template>
  <button
    ref="trigger"
    type="button"
    class="reader-note-indicator pt-note-marker"
    :class="{ highlighted }"
    :aria-label="label"
    :aria-describedby="preview ? tooltipId : undefined"
    title="View highlight note"
    @pointerdown.stop.prevent
    @mouseenter="preview = true"
    @mouseleave="preview = false"
    @focus="preview = true"
    @blur="preview = false"
    @click.stop="activate"
  >
    <UiIcon name="note" />
    <FloatingPopover v-if="preview" :anchor="trigger" @close="preview = false">
      <p :id="tooltipId" role="tooltip" class="reader-note-preview">
        {{ note.slice(0, 240) }}{{ note.length > 240 ? '…' : '' }}
      </p>
    </FloatingPopover>
  </button>
</template>
<style scoped>
.reader-note-indicator {
  position: absolute;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 8px;
  border-radius: 8px 0 0 8px;
  color: var(--pt-brand);
  background: var(--pt-panel);
  border: 1px solid var(--pt-brand);
  box-shadow: 0 3px 10px #0002;
}
.reader-note-indicator:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
.reader-note-preview {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-align: left;
}
</style>

<style scoped>
.reader-note-indicator {
  border-right: 0;
}
.reader-note-indicator:is(:hover, :active, :focus-visible, .highlighted) {
  border-left-width: 2px;
  background: var(--pt-control-surface);
  color: var(--pt-control-ink);
}
</style>
