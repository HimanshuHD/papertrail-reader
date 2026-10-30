<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useOverlayTarget } from '../../composables/useOverlayTarget'
import { openConfirmedLink } from '../../features/reader/document-links'
defineProps<{ url: string }>()
const emit = defineEmits<{ close: [] }>()
const target = useOverlayTarget(),
  id = useId()
const dialog = ref<HTMLDialogElement | null>(null),
  cancel = ref<HTMLButtonElement | null>(null)
const error = ref(''),
  opening = ref(false)
onMounted(async () => {
  await nextTick()
  if (dialog.value?.isConnected) {
    dialog.value.showModal()
    cancel.value?.focus()
  }
})
onBeforeUnmount(() => dialog.value?.close())
function keydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = Array.from(
    dialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
  )
  if (!buttons.length) return
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
  event.preventDefault()
  buttons[next]?.focus({ preventScroll: true })
}
function confirm(url: string) {
  if (opening.value) return
  opening.value = true
  if (openConfirmedLink(url)) emit('close')
  else {
    error.value =
      'The browser could not open the link. Allow pop-ups for PaperTrail, then try again.'
    opening.value = false
  }
}
</script>
<template>
  <Teleport :to="target">
    <dialog
      ref="dialog"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-description`"
      @keydown.stop="keydown"
      @pointerdown.stop
      @cancel.prevent="emit('close')"
    >
      <h2 :id="`${id}-title`">Open external link?</h2>
      <p :id="`${id}-description`">This link opens a website in a new browser tab.</p>
      <p class="destination">{{ url }}</p>
      <p v-if="error" role="status">{{ error }}</p>
      <div class="actions">
        <button ref="cancel" type="button" @click="emit('close')">Cancel</button>
        <button type="button" :disabled="opening" @click="confirm(url)">Open link</button>
      </div>
    </dialog>
  </Teleport>
</template>
<style scoped>
dialog {
  position: fixed;
  margin: auto;
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--pt-line);
  border-radius: 12px;
  background: var(--pt-panel);
  color: var(--pt-ink);
}
dialog::backdrop {
  background: #0008;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
p {
  margin: 8px 0;
  font-size: 14px;
}
.destination {
  overflow-wrap: anywhere;
  padding: 12px;
  background: var(--pt-canvas);
  border-radius: 6px;
  user-select: text;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
button {
  padding: 8px 16px;
  border: 1px solid var(--pt-line);
  border-radius: 6px;
}
button:last-child {
  background: var(--pt-brand);
  color: var(--pt-on-brand);
}
button:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
</style>
