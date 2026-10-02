<script setup lang="ts">
defineProps<{ name: 'refresh' | 'plus' | 'close' | 'library' }>()
const paths = {
  refresh: 'M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 2M4 16l2 2a7 7 0 0 0 12-2',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  library: 'M4 5h5v14H4zM9 5h5v14H9zM16 5l4-1 3 14-4 1z',
}
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="h-5 w-5"
  >
    <path :d="paths[name]" />
  </svg>
</template>
