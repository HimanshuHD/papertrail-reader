<script setup lang="ts">
import { useOverlayTarget } from '../composables/useOverlayTarget'
const overlayTarget = useOverlayTarget()
import { toasts, dismissToast } from '../composables/useToasts'
import UiIcon from './UiIcon.vue'
</script>
<template>
  <Teleport :to="overlayTarget">
    <div class="toast-host" role="status" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast-message">
          <UiIcon name="check" /><span>{{ toast.message }}</span>
          <button type="button" aria-label="Dismiss notification" @click="dismissToast(toast.id)">
            <UiIcon name="close" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
<style scoped>
.toast-host {
  position: fixed;
  z-index: 150;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: 10px;
  width: min(380px, calc(100vw - 32px));
  pointer-events: none;
}
.toast-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--pt-line);
  border-radius: 12px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  box-shadow: 0 8px 28px #0003;
  pointer-events: auto;
}
.toast-message > svg {
  color: var(--pt-brand);
  flex-shrink: 0;
}
.toast-message button {
  margin-left: auto;
  padding: 4px;
  border-radius: 6px;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
