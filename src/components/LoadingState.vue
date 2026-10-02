<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
const props = withDefaults(
  defineProps<{
    label: string
    detail?: string
    rotateMessages?: boolean
    announce?: boolean
  }>(),
  { announce: true, rotateMessages: false, detail: undefined },
)
const messages = ['Loading your documents…', 'Thanks for your patience', 'Almost there']
const messageIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  if (props.rotateMessages)
    timer = setInterval(() => {
      messageIndex.value = (messageIndex.value + 1) % messages.length
    }, 2500)
})
onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <div
    class="loading-view flex min-h-full items-center justify-center px-3 py-5"
    :role="announce ? 'status' : undefined"
    :aria-live="announce ? 'polite' : 'off'"
  >
    <div
      class="loading-card w-full max-w-xs rounded-2xl border border-line bg-panel px-5 py-6 text-center shadow-sm"
    >
      <div
        class="loading-emblem relative mx-auto mb-5 flex h-18 w-18 items-center justify-center"
        aria-hidden="true"
      >
        <div class="loading-halo absolute inset-0 rounded-full"></div>
        <div
          class="loading-orbit absolute inset-0 rounded-full border-2 border-line border-t-brand"
        ></div>
        <svg
          class="relative h-8 w-8 text-brand"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
          <path d="M14 3v5h5M8 12h8M8 16h6" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-ink">{{ label }}</p>
      <p
        v-if="rotateMessages"
        class="loading-message mt-2 min-h-10 text-xs leading-relaxed text-muted"
        aria-hidden="true"
      >
        {{ messages[messageIndex] }}
      </p>
      <p v-else-if="detail" class="mt-2 break-words text-xs leading-relaxed text-muted">
        {{ detail }}
      </p>
      <div v-if="$slots.default" class="mt-4"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.loading-view {
  animation: loading-enter 180ms ease-out;
}
.loading-halo {
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--pt-brand) 15%, transparent),
    transparent 72%
  );
}
.loading-orbit {
  animation: loading-spin 1400ms linear infinite;
}
@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes loading-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loading-orbit,
  .loading-view {
    animation: none;
  }
}
</style>
