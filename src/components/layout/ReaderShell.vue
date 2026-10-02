<script setup lang="ts">
defineProps<{ sidebarOpen: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div :class="['reader-layout', { 'sidebar-visible': sidebarOpen }]">
    <div v-if="!sidebarOpen" class="library-opener"><slot name="opener" /></div>
    <aside
      v-if="sidebarOpen"
      id="document-sidebar"
      class="library-scroll border-line bg-panel"
      aria-label="Document library"
      tabindex="0"
      @keydown.esc.stop="$emit('close')"
    >
      <slot name="sidebar" />
    </aside>
    <div class="reader-column">
      <slot name="toolbar" />
      <div class="reader-content"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.reader-layout {
  position: relative;
  display: grid;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr);
}
.library-opener {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 30;
}
.library-scroll {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 30;
  width: min(280px, 90%);
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  border-right: 1px solid var(--pt-line);
  box-shadow: 12px 0 24px rgb(0 0 0 / 12%);
}
.reader-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.reader-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
@media (min-width: 1024px) {
  .reader-layout.sidebar-visible {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .library-scroll {
    position: static;
    width: auto;
    box-shadow: none;
  }
}
</style>
