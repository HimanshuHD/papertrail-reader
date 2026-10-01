<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
const theme = useThemeStore()
function toggleTheme() {
  theme.setPreference(theme.preference === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3 text-sm text-muted">
      <span>Appearance</span>
      <button
        type="button"
        aria-label="Dark mode"
        :aria-pressed="theme.preference === 'dark'"
        :title="theme.preference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        class="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel p-1 text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        @click="toggleTheme"
      >
        <span
          :class="[
            'rounded-full p-2',
            theme.preference === 'light' ? 'bg-brand text-white' : 'text-muted',
          ]"
        >
          <svg
            aria-hidden="true"
            class="size-5"
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
            'rounded-full p-2',
            theme.preference === 'dark' ? 'bg-brand text-white' : 'text-muted',
          ]"
        >
          <svg
            aria-hidden="true"
            class="size-5"
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
