<script setup lang="ts">
const plannedFormats: readonly string[] = ['PDF', 'EPUB']
</script>

<template>
  <main class="foundation" aria-labelledby="app-title">
    <p class="eyebrow">Local-first document reader</p>
    <h1 id="app-title">PaperTrail</h1>
    <p class="tagline">Your documents. Your space. A better way to read.</p>
    <section class="status" aria-labelledby="status-title">
      <h2 id="status-title">Preview verification build</h2>
      <p>Vue, Vite and TypeScript are in place. Folder selection and document reading arrive in later milestones.</p>
      <p>Planned formats: {{ plannedFormats.join(' and ') }}.</p>
      <p class="note">This screen does not scan or open files yet.</p>
    </section>
  </main>
</template>
