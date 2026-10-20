<script setup lang="ts">
import { ref, onMounted, nextTick, useId } from 'vue'
import { version } from '../../package.json'
import FloatingPopover from './FloatingPopover.vue'
import UiIcon from './UiIcon.vue'

const repository = 'https://github.com/HimanshuHD/papertrail-reader'
const channel: string = import.meta.env.VITE_DEPLOY_CHANNEL || 'production'
const buildSha: string = import.meta.env.VITE_BUILD_SHA || ''
const sourceRef: string = import.meta.env.VITE_BRANCH_NAME || ''
const sha = /^[0-9a-f]{40}$/i.test(buildSha) ? buildSha : ''
const prNumber: string = import.meta.env.VITE_PR_NUMBER || ''
const pr = /^[1-9]\d*$/.test(prNumber) ? prNumber : ''
const channelLabel = !sha
  ? 'Development'
  : channel === 'preview' || pr
    ? 'Preview'
    : channel === 'staging'
      ? 'Staging'
      : channel === 'release'
        ? 'Release archive'
        : 'Production'
const tagged = channel === 'release' || sourceRef.startsWith('refs/tags/')
const branch = sourceRef.replace(/^refs\/(heads|tags)\//, '')
const detached = branch === 'HEAD' || /^[0-9a-f]{40}$/i.test(branch)
// Do not fabricate repository links for detached or malformed Git ref metadata.
const validRef =
  branch &&
  !detached &&
  !/[\s~^:?*[\\]/.test(branch) &&
  !branch.includes('..') &&
  !branch.includes('@{') &&
  branch !== '@' &&
  !branch.startsWith('-') &&
  branch
    .split('/')
    .every(
      (part) => part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'),
    )
const branchUrl = validRef
  ? `${repository}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
  : ''
const notice = ref('')
const open = ref(false)
const anchor = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelId = useId()
function dismiss() {
  open.value = false
}
function toggle() {
  open.value = !open.value
}
function focusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (next === anchor.value || (next && panel.value?.contains(next))) return
  dismiss()
}
async function focusDetails(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && !(event.key === 'Tab' && !event.shiftKey && open.value)) return
  event.preventDefault()
  open.value = true
  await nextTick()
  ;(panel.value?.querySelector<HTMLElement>('a') || panel.value)?.focus()
}
function key(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    dismiss()
    anchor.value?.focus({ preventScroll: true })
  } else if (
    event.key === 'Tab' &&
    event.shiftKey &&
    event.target === (panel.value?.querySelector('a') || panel.value)
  ) {
    event.preventDefault()
    dismiss()
    anchor.value?.focus({ preventScroll: true })
  }
}
onMounted(async () => {
  if (!['staging', 'preview'].includes(channel)) return
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'channel.json')
    if (!response.ok) return
    const data = await response.json()
    if (channel === 'staging')
      notice.value = data.aligned
        ? `Staging matches production v${data.productionVersion}. No unreleased changes.`
        : 'Staging contains unreleased changes.'
    else if (data.draft) notice.value = 'Published revision · PR currently draft'
  } catch {
    /* A static/local preview may have no channel status file. */
  }
})
</script>

<template>
  <footer
    class="build-footer"
    role="contentinfo"
    aria-label="Deployment information"
    @keydown="key"
  >
    <div class="build-summary">
      <span>{{ channelLabel }} · v{{ version }}</span>
      <button
        ref="anchor"
        type="button"
        class="build-info pt-plain-control"
        aria-label="Build details"
        :aria-expanded="open"
        :aria-controls="open ? panelId : undefined"
        @blur="focusOut"
        @click="toggle"
        @keydown="focusDetails"
      >
        <UiIcon name="info" />
      </button>
    </div>
    <span v-if="notice" class="build-notice" role="status">{{ notice }}</span>
    <FloatingPopover
      v-if="open"
      :anchor="anchor"
      :reserve-aside-header="false"
      compact
      @close="dismiss"
    >
      <section
        :id="panelId"
        ref="panel"
        class="build-details"
        role="region"
        aria-label="Build details"
        tabindex="-1"
        @focusout="focusOut"
        @keydown="key"
      >
        <h2>Build details</h2>
        <dl>
          <template v-if="pr"
            ><dt>Preview</dt>
            <dd>
              <a :href="`${repository}/pull/${pr}`">PR #{{ pr }}</a>
            </dd></template
          >
          <dt>{{ tagged ? 'Tag' : 'Branch' }}</dt>
          <dd>
            <a v-if="branchUrl" :href="branchUrl">{{ branch }}</a
            ><span v-else>{{ detached ? 'Detached revision' : 'Unavailable' }}</span>
          </dd>
          <dt>SHA</dt>
          <dd>
            <a v-if="sha" :href="`${repository}/commit/${sha}`" :title="sha">{{
              sha.slice(0, 7)
            }}</a
            ><span v-else>Unavailable</span>
          </dd>
        </dl>
      </section>
    </FloatingPopover>
  </footer>
</template>

<style scoped>
.build-footer {
  padding: 0.125rem 0.5rem;
  border-top: 1px solid var(--pt-line);
  background: var(--pt-panel);
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--pt-muted);
  min-width: 0;
  overflow-wrap: anywhere;
}
.build-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  text-align: center;
}
.build-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--pt-brand);
  cursor: pointer;
}
.build-info :deep(svg) {
  width: 16px;
  height: 16px;
}
.build-info:focus-visible,
.build-details a:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
.build-notice {
  display: block;
  text-align: center;
}
.build-details {
  min-width: 0;
  font-size: 0.75rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.build-details h2 {
  color: var(--pt-ink);
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.build-details dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.125rem 0.375rem;
  align-items: baseline;
}
.build-details dt {
  color: var(--pt-muted);
}
.build-details a {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  max-width: 100%;
  color: var(--pt-brand);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
