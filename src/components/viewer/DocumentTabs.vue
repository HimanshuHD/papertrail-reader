<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { DocumentSession } from '../../features/reader/document-sessions'
import UiIcon from '../UiIcon.vue'
const props = defineProps<{ tabs: readonly DocumentSession[]; selectedId: string | null }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string]; add: [] }>()
const root = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const focused = ref<string | null>(null)
const hovered = ref<string | null>(null)
const focusedTitle = ref<string | null>(null)
const fullTitle = computed(() =>
  props.tabs.find((tab) => tab.id === (hovered.value ?? focusedTitle.value)),
)
const menuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
function focusTitle(id: string) {
  focused.value = id
  focusedTitle.value = id
}
function label(tab: DocumentSession) {
  return `${tab.format}: ${tab.title}`
}
function status(tab: DocumentSession) {
  return {
    loading: 'Loading',
    ready: 'Ready',
    suspended: 'Ready',
    reconnect: 'Reconnect required',
    error: 'Unable to open',
    closed: 'Closed',
  }[tab.phase]
}
function tabButton(id: string) {
  return strip.value?.querySelector<HTMLButtonElement>(`[id="${id}-tab"]`)
}
function reveal(id: string | null) {
  if (id)
    tabButton(id)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
}
watch(
  () => props.selectedId,
  async (id) => {
    focused.value = id
    await nextTick()
    reveal(id)
  },
  { immediate: true },
)
async function focusTab(id: string) {
  focused.value = id
  await nextTick()
  tabButton(id)?.focus({ preventScroll: true })
  reveal(id)
}
function keys(event: KeyboardEvent, id: string) {
  event.stopPropagation()
  const index = props.tabs.findIndex((tab) => tab.id === id)
  let next: number
  if (event.key === 'ArrowRight') next = (index + 1) % props.tabs.length
  else if (event.key === 'ArrowLeft') next = (index - 1 + props.tabs.length) % props.tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = props.tabs.length - 1
  else if (event.key === 'Delete') {
    event.preventDefault()
    void close(id)
    return
  } else return
  event.preventDefault()
  const target = props.tabs[next]
  if (target) void focusTab(target.id)
}
async function close(id: string) {
  const index = props.tabs.findIndex((tab) => tab.id === id)
  const next = props.tabs[index + 1] ?? props.tabs[index - 1]
  const wasFocused = root.value?.contains(document.activeElement)
  emit('close', id)
  await nextTick()
  if (wasFocused) {
    if (next) await focusTab(next.id)
    else
      root.value
        ?.querySelector<HTMLButtonElement>('[aria-label="Add local documents from tabs"]')
        ?.focus()
  }
}
async function toggleMenu() {
  menuOpen.value = !menuOpen.value
  await nextTick()
  if (menuOpen.value)
    menu.value?.querySelector<HTMLButtonElement>('[aria-checked="true"], button')?.focus()
}
function dismiss(restore = false) {
  menuOpen.value = false
  if (restore) menuButton.value?.focus()
}
async function choose(id: string) {
  dismiss()
  emit('activate', id)
  await focusTab(id)
}
function menuKeys(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    dismiss(true)
    return
  }
  const buttons = [...(menu.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  let next: number
  if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
  else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = buttons.length - 1
  else return
  event.preventDefault()
  buttons[next]?.focus()
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) dismiss()
}
function focusLeaves(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) dismiss()
}
// Register only while the menu is open; closing the last tab also removes the menu.
watch(menuOpen, (open) => {
  document.removeEventListener('pointerdown', outside)
  if (open) document.addEventListener('pointerdown', outside)
})
watch(
  () => props.tabs.length,
  (length) => {
    if (!length) dismiss()
  },
)
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="document-tabs" @focusout="focusLeaves" @keydown.stop>
    <div
      ref="strip"
      role="tablist"
      aria-label="Open documents"
      aria-orientation="horizontal"
      class="tab-strip"
    >
      <div
        v-for="tab in tabs"
        :key="tab.id"
        role="presentation"
        class="document-tab"
        :class="{ selected: selectedId === tab.id }"
      >
        <button
          :id="`${tab.id}-tab`"
          type="button"
          role="tab"
          :aria-selected="selectedId === tab.id"
          :aria-controls="`${tab.id}-panel`"
          :tabindex="(focused || selectedId || tabs[0]?.id) === tab.id ? 0 : -1"
          :aria-label="`${label(tab)} — ${status(tab)}`"
          :title="`${label(tab)} — ${status(tab)}. Delete closes this tab.`"
          aria-keyshortcuts="Delete"
          class="tab-activate"
          @focus="focusTitle(tab.id)"
          @blur="focusedTitle = null"
          @mouseenter="hovered = tab.id"
          @mouseleave="hovered = null"
          @click="emit('activate', tab.id)"
          @keydown="keys($event, tab.id)"
        >
          <span class="tab-format" aria-hidden="true">{{ tab.format }}</span>
          <span class="tab-title">{{ tab.title }}</span>
          <span
            v-if="tab.phase === 'loading' || tab.phase === 'error' || tab.phase === 'reconnect'"
            aria-hidden="true"
            class="tab-status"
            >{{ tab.phase === 'loading' ? '…' : '!' }}</span
          >
        </button>
        <button
          type="button"
          :aria-label="`Close ${label(tab)}`"
          tabindex="-1"
          class="tab-close"
          @click="close(tab.id)"
        >
          <UiIcon name="close" />
        </button>
      </div>
    </div>
    <button
      type="button"
      aria-label="Add local documents from tabs"
      title="Add local documents"
      class="tab-action"
      @click="emit('add')"
    >
      <UiIcon name="plus" />
    </button>
    <button
      ref="menuButton"
      type="button"
      aria-label="Open document list"
      aria-haspopup="menu"
      aria-controls="open-document-menu"
      :aria-expanded="menuOpen"
      :disabled="!tabs.length"
      class="tab-action tab-overflow"
      @click="toggleMenu"
      @keydown.down.prevent="!menuOpen && toggleMenu()"
    >
      <span aria-hidden="true">…</span>
    </button>
    <div
      v-if="fullTitle && !menuOpen"
      class="tab-tooltip border border-line bg-panel"
      aria-hidden="true"
    >
      {{ label(fullTitle) }} — {{ status(fullTitle) }}
    </div>
    <div
      v-if="menuOpen"
      id="open-document-menu"
      ref="menu"
      role="menu"
      aria-label="Open documents"
      class="tab-menu border border-line bg-panel"
      @keydown="menuKeys"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="menuitemradio"
        :aria-checked="selectedId === tab.id"
        :title="label(tab)"
        @click="choose(tab.id)"
      >
        <span aria-hidden="true">{{ selectedId === tab.id ? '✓' : '' }}</span
        ><span>{{ label(tab) }} — {{ status(tab) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.document-tabs {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  position: relative;
  align-self: stretch;
  color: var(--pt-ink);
}
.tab-strip {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  align-self: stretch;
}
.document-tab {
  display: flex;
  flex: 0 0 auto;
  max-width: 240px;
  min-width: 72px;
  border-right: 1px solid var(--pt-line);
  border-bottom: 2px solid transparent;
}
.document-tab.selected {
  border-bottom-color: var(--pt-brand);
  background: var(--pt-canvas);
}
.tab-activate {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 8px;
  min-height: 44px;
  text-align: left;
  font-size: 12px;
}
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-format {
  font-size: 9px;
  color: var(--pt-muted);
  flex-shrink: 0;
}
.tab-status {
  color: var(--pt-brand);
}
.tab-action,
.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  min-height: 44px;
  color: var(--pt-muted);
}
.tab-close {
  width: 32px;
}
.tab-overflow {
  font-size: 24px;
  line-height: 1;
}
button:hover {
  background: var(--pt-canvas);
  color: var(--pt-brand);
}
button:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: -3px;
}
button:disabled {
  opacity: 0.4;
}
.tab-tooltip {
  position: absolute;
  right: 4px;
  top: 100%;
  z-index: 49;
  pointer-events: none;
  width: max-content;
  max-width: min(320px, calc(100vw - 24px));
  padding: 8px;
  border-radius: 6px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.tab-menu {
  position: absolute;
  right: 4px;
  top: 100%;
  z-index: 50;
  width: 320px;
  max-width: calc(100vw - 24px);
  max-height: min(360px, 60dvh);
  overflow: auto;
  border-radius: 8px;
  padding: 4px;
}
.tab-menu button {
  display: flex;
  gap: 8px;
  align-items: center;
  text-align: left;
  width: 100%;
  min-height: 44px;
  padding: 8px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.tab-menu button > span:first-child {
  flex: 0 0 12px;
}
@media (max-width: 600px) {
  .document-tab {
    max-width: 180px;
  }
  .tab-format {
    display: none;
  }
}
</style>
