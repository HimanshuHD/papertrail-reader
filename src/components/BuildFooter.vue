<script setup lang="ts">
import { version } from '../../package.json'

const repository = 'https://github.com/HimanshuHD/papertrail-reader'
const buildSha: string = import.meta.env.VITE_BUILD_SHA || ''
const branch: string = import.meta.env.VITE_BRANCH_NAME || ''
const branchUrl = `${repository}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
const prNumber: string = import.meta.env.VITE_PR_NUMBER || ''
const sha = /^[0-9a-f]{40}$/i.test(buildSha) ? buildSha : ''
const pr = /^[1-9]\d*$/.test(prNumber) ? prNumber : ''
</script>

<template>
  <footer class="build-footer" aria-label="Deployment information">
    <template v-if="sha">
      <span v-if="pr"
        >Preview · <a :href="`${repository}/pull/${pr}`">PR #{{ pr }}</a></span
      >
      <span v-else>Production · v{{ version }}</span>
      <span v-if="branch"
        >Branch <a :href="branchUrl">{{ branch }}</a></span
      >
      <span
        >SHA <a :href="`${repository}/commit/${sha}`" :title="sha">{{ sha.slice(0, 7) }}</a></span
      >
    </template>
    <span v-else>Development · SHA unavailable</span>
  </footer>
</template>

<style scoped>
.build-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.125rem 0.75rem;
  padding: 0.125rem 0.75rem;
  border-top: 1px solid var(--pt-line);
  background: var(--pt-panel);
  line-height: 1.5;
  overflow-wrap: anywhere;
  font-size: 0.8rem;
  color: var(--pt-muted);
  min-width: 0;
}
.build-footer a {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  min-width: 24px;
  max-width: 100%;
  color: var(--pt-brand);
  text-underline-offset: 0.2em;
}
.build-footer a:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
</style>
