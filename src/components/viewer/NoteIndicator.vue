<script setup lang="ts">
import UiIcon from '../UiIcon.vue'
defineProps<{ note: string; label: string }>()
defineEmits<{ activate: [] }>()
</script>
<template>
  <button
    type="button"
    class="reader-note-indicator"
    :aria-label="label"
    @pointerdown.stop
    @click.stop="$emit('activate')"
  >
    <UiIcon name="annotations" />
    <span role="tooltip" class="reader-note-preview"
      >{{ note.slice(0, 240) }}{{ note.length > 240 ? '…' : '' }}</span
    >
  </button>
</template>
<style scoped>
.reader-note-indicator {
  position: absolute;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 28px;
  border-radius: 6px;
  color: var(--pt-brand);
  background: var(--pt-panel);
  border: 1px solid var(--pt-line);
}
.reader-note-indicator:hover {
  color: var(--pt-ink);
}
.reader-note-indicator:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
.reader-note-preview {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: min(260px, 70vw);
  max-height: 160px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--pt-line);
  background: var(--pt-panel);
  color: var(--pt-ink);
  box-shadow: 0 6px 18px #0002;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  text-align: left;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}
.reader-note-indicator:hover .reader-note-preview,
.reader-note-indicator:focus-visible .reader-note-preview {
  visibility: visible;
  opacity: 1;
}
</style>
