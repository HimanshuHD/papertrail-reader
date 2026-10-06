<script setup lang="ts">
defineProps<{
  name:
    | 'edit'
    | 'trash'
    | 'check'
    | 'note'
    | 'clock'
    | 'refresh'
    | 'plus'
    | 'close'
    | 'library'
    | 'previous'
    | 'next'
    | 'zoom-out'
    | 'zoom-in'
    | 'fit-width'
    | 'fit-page'
    | 'annotations'
    | 'highlight'
    | 'more'
    | 'bookmark'
    | 'contents'
    | 'typography'
    | 'search'
    | 'fullscreen'
    | 'fullscreen-exit'
    | 'help'
}>()
const paths = {
  edit: 'm16 3 5 5-13 13H3v-5L16 3ZM14 5l5 5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  check: 'm5 12 4 4L19 6',
  note: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5ZM8 10h8M8 14h5',
  // Lucide clock; existing library license in docs/licenses/lucide.txt.
  clock: 'M12 6v6l4 2',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 2M4 16l2 2a7 7 0 0 0 12-2',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  library: 'M4 5h5v14H4zM9 5h5v14H9zM16 5l4-1 3 14-4 1z',
  previous: 'm15 18-6-6 6-6',
  next: 'm9 18 6-6-6-6',
  // Lucide zoom icons (Feather-derived); licenses in docs/licenses/lucide.txt.
  'zoom-out': 'M21 21 16.65 16.65M8 11h6',
  'zoom-in': 'M21 21 16.65 16.65M8 11h6M11 8v6',
  'fit-width': 'M4 7h16M4 12h16M4 17h16M2 7l2-2 2 2M22 17l-2 2-2-2',
  'fit-page': 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  annotations:
    'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5ZM8 10h8M8 14h5',
  highlight: 'm9 11-6 6v3h3l6-6m-3-3 9-9 4 4-9 9-4-4Z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  typography: 'M4 19 10 5l6 14M6 15h8M17 11h5M19.5 11v8',
  contents: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  search: 'm21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z',
  fullscreen:
    'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3',
  'fullscreen-exit': 'M8 3v5H3M21 8h-5V3M3 16h5v5M16 21v-5h5',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
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
    <circle v-if="name === 'zoom-in' || name === 'zoom-out'" cx="11" cy="11" r="8" />
    <circle v-if="name === 'clock'" cx="12" cy="12" r="10" />
    <path :d="paths[name]" />
  </svg>
</template>
