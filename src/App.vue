<script setup lang="ts">
import { RouterView } from 'vue-router'
import BuildFooter from './components/BuildFooter.vue'
</script>

<template>
  <div class="flex min-h-svh flex-col bg-canvas text-ink">
    <div class="flex-1"><RouterView /></div>
    <BuildFooter />
  </div>
</template>
