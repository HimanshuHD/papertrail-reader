<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DocumentSession } from '../../features/reader/document-sessions'
import UiIcon from '../UiIcon.vue'
import IconButton from '../IconButton.vue'
import AccessibleTooltip from '../AccessibleTooltip.vue'
import { useId } from 'vue'
const tooltipId = useId()
import FileTypeIcon from '../icons/FileTypeIcon.vue'
const props = defineProps<{ tabs: readonly DocumentSession[]; selectedId: string | null }>()
const emit = defineEmits<{ activate: [id: string]; close: [id: string]; emptyClose: [] }>()
const root = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const overflowing = ref(false)
let observer: ResizeObserver | undefined
function measureOverflow() {
  const element = strip.value
  if (!element) return
  const available = element.clientWidth + (overflowing.value ? 44 : 0)
  overflowing.value = props.tabs.length > 0 && element.scrollWidth > available + 1
  if (!overflowing.value && (menuOpen.value || document.activeElement === menuButton.value)) {
    dismiss()
    if (props.selectedId) void focusTab(props.selectedId)
  }
}
onMounted(() => {
  measureOverflow()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measureOverflow)
    if (root.value) observer.observe(root.value)
    if (strip.value) observer.observe(strip.value)
  }
  window.addEventListener('resize', measureOverflow)
})
watch(
  () => props.tabs.map((tab) => `${tab.id}:${tab.title}`).join('|'),
  async () => {
    await nextTick()
    measureOverflow()
  },
)
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', measureOverflow)
})
const focused = ref<string | null>(null)
const hovered = ref<string | null>(null)
const focusedTitle = ref<string | null>(null)
const fullTitle = computed(() =>
  props.tabs.find((tab) => tab.id === (hovered.value ?? focusedTitle.value)),
)
const menuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
function dismissTitle() {
  hovered.value = null
  focusedTitle.value = null
}
function activateTab(id: string) {
  dismissTitle()
  emit('activate', id)
}
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
    else emit('emptyClose')
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
          :aria-describedby="fullTitle?.id === tab.id ? tooltipId : undefined"
          aria-keyshortcuts="Delete"
          class="tab-activate pt-plain-control"
          @focus="focusTitle(tab.id)"
          @blur="focusedTitle = null"
          @mouseenter="hovered = tab.id"
          @mouseleave="hovered = null"
          @click="activateTab(tab.id)"
          @keydown="keys($event, tab.id)"
        >
          <FileTypeIcon :extension="tab.format" />
          <span class="tab-title">{{ tab.title }}</span>
          <span
            v-if="tab.phase === 'loading' || tab.phase === 'error' || tab.phase === 'reconnect'"
            aria-hidden="true"
            class="tab-status"
            >{{ tab.phase === 'loading' ? '…' : '!' }}</span
          >
        </button>
        <IconButton
          class="tab-close pt-plain-control"
          icon="close"
          :label="`Close ${tab.title}`"
          @click.stop="close(tab.id)"
          @keydown.delete.stop.prevent="close(tab.id)"
        />
      </div>
    </div>
    <button
      v-if="overflowing"
      ref="menuButton"
      type="button"
      aria-label="Open document list"
      aria-haspopup="menu"
      aria-controls="open-document-menu"
      :aria-expanded="menuOpen"
      :disabled="!tabs.length"
      class="tab-action tab-overflow pt-plain-control"
      @click="toggleMenu"
      @keydown.down.prevent="!menuOpen && toggleMenu()"
    >
      <UiIcon name="more" />
    </button>
    <AccessibleTooltip
      :id="tooltipId"
      :anchor="fullTitle ? (tabButton(fullTitle.id) ?? null) : null"
      :open="!!fullTitle && !menuOpen"
      :text="fullTitle ? `${label(fullTitle)} — ${status(fullTitle)}` : ''"
      @dismiss="dismissTitle"
    />
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
  z-index: 1;
  color: var(--pt-ink);
}
.tab-strip {
  display: flex;
  flex: 1;
  gap: 3px;
  min-width: 0;
  padding: 3px 12px 3px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  align-self: stretch;
}
.document-tab {
  position: relative;
  display: flex;
  flex: 0 0 236px;
  max-width: 260px;
  min-width: 80px;
}
.tab-activate {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0 36px 0 10px;
  min-height: 40px;
  border: 1px solid var(--pt-line);
  border-radius: 5px 5px 2px 2px;
  background: color-mix(in srgb, var(--pt-panel) 75%, var(--pt-canvas));
  color: var(--pt-ink);
  box-shadow: none;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
}
.tab-activate:hover {
  border-color: color-mix(in srgb, var(--pt-brand) 60%, var(--pt-line));
  background: var(--pt-control-surface);
}
.document-tab.selected .tab-activate {
  border-color: var(--pt-brand);
  border-width: 2px 2px 0;
  /* Extend across the 3px gutter and shell rule, visually joining the reader toolbar. */
  border-bottom-color: transparent;
  border-radius: 5px 5px 0 0;
  background: var(--pt-panel);
  margin-bottom: -4px;
  padding-bottom: 4px;
  position: relative;
  z-index: 1;
}
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-status {
  color: var(--pt-brand);
}
.tab-close {
  position: absolute;
  right: 6px;
  top: 5px;
  width: 24px;
  padding: 0;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  height: 28px;
  margin-left: auto;
  color: var(--pt-muted);
}
.tab-close :deep(svg) {
  width: 14px;
  height: 14px;
}
.tab-close:hover,
.selected .tab-close {
  color: var(--pt-brand);
}
.tab-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  min-height: 44px;
  color: var(--pt-muted);
  border: 0;
  box-shadow: none;
}
.tab-action:hover {
  background: var(--pt-canvas);
  color: var(--pt-brand);
}
.tab-overflow {
  font-size: 24px;
  line-height: 1;
}
button:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: -3px;
}
button:disabled {
  opacity: 0.4;
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
}
.document-tab:hover .tab-close :deep(svg) {
  stroke-width: 3px;
}
</style>
