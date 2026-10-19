<script setup lang="ts">
import { computed } from 'vue'
import pdf from '../../assets/icons/pdf.svg'
import epub from '../../assets/icons/epub.svg'
import doc from '../../assets/icons/doc.svg'
import file from '../../assets/icons/file.svg'
const props = defineProps<{ extension: string }>()
const icon = computed(
  () =>
    ({ PDF: pdf, EPUB: epub, DOC: doc, DOCX: doc })[
      props.extension.replace(/^\./, '').toUpperCase()
    ] ?? file,
)
</script>
<template>
  <span class="file-type-icon" aria-hidden="true" :style="{ maskImage: `url(${icon})` }" />
</template>
<style scoped>
.file-type-icon {
  display: inline-flex;
  flex: 0 0 30px;
  width: 30px;
  height: 20px;
  background: var(--pt-brand);
  mask-size: contain;
  mask-position: center;
  mask-repeat: no-repeat;
}
</style>
