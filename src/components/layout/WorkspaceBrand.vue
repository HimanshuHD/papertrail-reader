<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandMark from '../BrandMark.vue'
import ThemePicker from '../ThemePicker.vue'
</script>

<template>
  <div class="app-header workspace-brand">
    <RouterLink to="/" aria-label="PaperTrail home" class="workspace-logo text-brand">
      <BrandMark class="h-7 w-7" />
    </RouterLink>
    <ThemePicker compact />
  </div>
</template>

<style scoped>
.workspace-brand {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: 46px;
  padding: 0 12px;
  background: var(--pt-panel);
}
.workspace-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
}
.workspace-logo:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
</style>
