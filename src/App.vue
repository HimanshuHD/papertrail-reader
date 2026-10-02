<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
const route = useRoute()
import BuildFooter from './components/BuildFooter.vue'
</script>

<template>
  <div
    :class="[
      'flex flex-col bg-canvas text-ink',
      route.name === 'reader' ? 'app-frame' : 'min-h-svh',
    ]"
  >
    <div class="min-h-0 flex-1"><RouterView /></div>
    <BuildFooter />
  </div>
</template>

<style scoped>
.app-frame {
  height: 100dvh;
  overflow: hidden;
}
.app-frame :deep(.build-footer) {
  flex-shrink: 0;
  max-height: 20dvh;
  overflow: auto;
  padding: 0.4rem 1rem;
}
</style>
