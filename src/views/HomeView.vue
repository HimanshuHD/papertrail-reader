<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandMark from '../components/BrandMark.vue'
import ThemePicker from '../components/ThemePicker.vue'
const plannedFormats: readonly string[] = ['PDF', 'EPUB']
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-6 py-10 sm:px-12 sm:py-16" aria-labelledby="app-title">
    <div class="mb-10 flex flex-wrap items-center justify-between gap-4">
      <p class="text-xs font-bold tracking-widest text-brand uppercase">
        Local-first document reader
      </p>
      <ThemePicker />
    </div>
    <h1
      id="app-title"
      class="flex items-center gap-3 text-4xl leading-tight font-bold tracking-tight sm:text-6xl"
    >
      <BrandMark class="h-12 w-12 sm:h-16 sm:w-16" />
      PaperTrail
    </h1>
    <p class="mt-4 text-lg text-muted">Your documents. Your space. A better way to read.</p>
    <section
      class="mt-8 rounded-card border border-line bg-panel p-6 sm:p-8"
      aria-labelledby="status-title"
    >
      <h2 id="status-title" class="text-xl font-semibold">The foundation is ready</h2>
      <p class="mt-4 leading-relaxed text-muted">
        Folder selection and document reading arrive in later milestones.
      </p>
      <p class="mt-3">Planned formats: {{ plannedFormats.join(' and ') }}.</p>
      <p class="mt-4 text-sm text-muted">This screen does not scan or open files yet.</p>
      <RouterLink
        to="/app"
        class="pt-button pt-button-filled mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 font-semibold text-canvas sm:w-auto"
        >Go to app <span aria-hidden="true">→</span></RouterLink
      >
    </section>
  </main>
</template>
