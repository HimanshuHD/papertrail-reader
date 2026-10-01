<script setup lang="ts">
defineProps<{ sidebarOpen: boolean }>()
</script>

<template>
  <div :class="['reader-layout', { 'sidebar-visible': sidebarOpen }]">
    <aside
      v-if="sidebarOpen"
      id="document-sidebar"
      class="min-w-0 border-b border-line bg-panel lg:border-r lg:border-b-0"
      aria-label="Document library"
    >
      <slot name="sidebar" />
    </aside>
    <div class="min-w-0">
      <slot name="toolbar" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
.reader-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 1024px) {
  .reader-layout.sidebar-visible {
    grid-template-columns: 280px minmax(0, 1fr);
  }
}
</style>
