<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
import { isThemePreference } from '../services/theme-preferences'

const theme = useThemeStore()
function changeTheme(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isThemePreference(value)) theme.setPreference(value)
}
</script>

<template>
  <div class="space-y-2">
    <label for="theme-preference" class="flex items-center gap-3 text-sm text-muted">
      Appearance
      <select
        id="theme-preference"
        :value="theme.preference"
        class="rounded-lg border border-line bg-panel px-3 py-2 text-ink"
        @change="changeTheme"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    <p v-if="!theme.storageAvailable" role="status" class="text-sm text-muted">
      Your theme works for this session; browser storage is unavailable.
    </p>
  </div>
</template>
