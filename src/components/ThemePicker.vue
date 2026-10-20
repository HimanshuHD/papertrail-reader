<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
defineProps<{ compact?: boolean }>()
const theme = useThemeStore()
function toggleTheme() {
  theme.setPreference(theme.preference === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <div :class="['space-y-2', { 'theme-compact': compact }]">
    <div class="flex items-center gap-3 text-sm text-muted">
      <button
        type="button"
        aria-label="Dark mode"
        :aria-pressed="theme.preference === 'dark'"
        :title="theme.preference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        class="theme-toggle pt-plain-control inline-flex items-center rounded-full text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        @click="toggleTheme"
      >
        <span
          :class="[
            'theme-option rounded-full',
            theme.preference === 'light' ? 'pt-on-brand' : 'text-muted',
          ]"
        >
          <svg
            aria-hidden="true"
            class="size-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
            />
          </svg>
        </span>
        <span
          :class="[
            'theme-option rounded-full',
            theme.preference === 'dark' ? 'pt-on-brand' : 'text-muted',
          ]"
        >
          <svg
            aria-hidden="true"
            class="size-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          >
            <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
          </svg>
        </span>
        <span class="sr-only">{{ theme.preference === 'dark' ? 'Dark' : 'Light' }} appearance</span>
      </button>
    </div>
    <p v-if="!theme.storageAvailable" role="status" class="text-sm text-muted">
      Your theme works for this session; browser storage is unavailable.
    </p>
  </div>
</template>

<style scoped>
.theme-toggle {
  position: relative;
  height: 36px;
  padding: 3px;
  gap: 0;
  border: 1px solid color-mix(in srgb, var(--pt-brand) 45%, var(--pt-line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--pt-brand) 12%, var(--pt-canvas));
}
.theme-toggle::before {
  content: '';
  position: absolute;
  width: 28px;
  height: 28px;
  left: 2px;
  top: 50%;
  margin-top: -14px;
  border-radius: 50%;
  background: var(--pt-brand);
  transform: translateX(0);
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.theme-toggle[aria-pressed='true']::before {
  transform: translateX(28px);
}
.theme-option {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 5px;
  transition: color 180ms ease;
}
.theme-compact button {
  height: 34px;
  padding: 2px;
}
.theme-compact p {
  max-width: 10rem;
  font-size: 0.75rem;
}
@media (prefers-reduced-motion: reduce) {
  .theme-toggle::before,
  .theme-option {
    transition: none;
  }
}
</style>
