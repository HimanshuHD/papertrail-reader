<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import AccessibleTooltip from '../AccessibleTooltip.vue'
import FloatingPopover from '../FloatingPopover.vue'
import UiIcon from '../UiIcon.vue'

export type ReaderNoticeSection = {
  title: string
  label: string
  message: string
  reasons?: readonly string[]
}
const props = withDefaults(
  defineProps<{
    sections: ReaderNoticeSection[]
    active?: boolean
    viewport?: HTMLElement | null
  }>(),
  {
    active: true,
    viewport: null,
  },
)
const id = useId()
const root = ref<HTMLElement | null>(null)
const inset = ref({ top: '12px', right: '12px' })
const trigger = ref<HTMLButtonElement | null>(null)
watch(
  [() => props.viewport, () => props.active, () => JSON.stringify(props.sections)],
  ([viewport, active], _, cleanup) => {
    let observer: ResizeObserver | undefined
    let cancelled = false
    cleanup(() => {
      cancelled = true
      observer?.disconnect()
    })
    void nextTick().then(() => {
      const parent = root.value?.offsetParent as HTMLElement | null
      if (cancelled || !active || !viewport || !parent) return
      const place = () => {
        const page = viewport.getBoundingClientRect(),
          stage = parent.getBoundingClientRect()
        inset.value = {
          top: `${Math.max(12, page.top - stage.top + viewport.clientTop + 12)}px`,
          right: `${Math.max(12, stage.right - page.left - viewport.clientLeft - viewport.clientWidth + 12)}px`,
        }
      }
      place()
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(place)
        observer.observe(viewport)
        observer.observe(parent)
      }
    })
  },
  { immediate: true, flush: 'post' },
)
const closeButton = ref<HTMLButtonElement | null>(null)
const expanded = ref(false)
const tooltip = ref(false)
const signature = computed(() => JSON.stringify(props.sections))
const title = computed(() =>
  props.sections.length === 1 ? props.sections[0]!.title : 'Rendering information',
)
const arrival = ref(false)
let lastSeen = ''
watch(
  [signature, () => props.active],
  ([value, active]) => {
    expanded.value = false
    tooltip.value = false
    arrival.value = active && value !== lastSeen
    if (active) lastSeen = value
  },
  { immediate: true },
)
async function toggle() {
  tooltip.value = false
  expanded.value = !expanded.value
  if (expanded.value) {
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
  }
}
function close(restoreFocus = false) {
  expanded.value = false
  tooltip.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
</script>

<template>
  <div v-if="sections.length && active !== false" ref="root" class="reader-notice" :style="inset">
    <button
      :key="signature"
      ref="trigger"
      type="button"
      class="reader-notice-trigger"
      :class="{ arrival }"
      aria-label="Rendering information"
      :aria-expanded="expanded"
      :aria-controls="expanded ? `${id}-details` : undefined"
      :aria-describedby="tooltip && !expanded ? `${id}-tooltip` : undefined"
      aria-haspopup="dialog"
      @animationend="arrival = false"
      @click.stop="toggle"
      @mouseenter="tooltip = true"
      @mouseleave="tooltip = false"
      @focus="tooltip = true"
      @blur="tooltip = false"
    >
      <UiIcon name="info" />
    </button>
    <!-- One polite announcement per changed section; details are not another live region. -->
    <p
      v-for="section in sections"
      :key="section.label"
      role="status"
      :aria-label="section.label"
      class="sr-only"
    >
      {{ section.message }} {{ section.reasons?.join(' ') }}
    </p>
    <AccessibleTooltip
      :id="`${id}-tooltip`"
      :anchor="trigger"
      text="Rendering information"
      :open="tooltip && !expanded"
      @dismiss="tooltip = false"
    />
    <FloatingPopover
      v-if="expanded"
      :anchor="trigger"
      notice
      :reserve-aside-header="false"
      @close="close()"
    >
      <div
        :id="`${id}-details`"
        role="dialog"
        :aria-labelledby="`${id}-title`"
        class="reader-notice-details"
      >
        <header>
          <UiIcon name="info" class="notice-heading-icon" />
          <h3 :id="`${id}-title`">{{ title }}</h3>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close rendering information"
            class="notice-close"
            @click="close(true)"
          >
            <UiIcon name="close" />
          </button>
        </header>
        <section v-for="section in sections" :key="section.label">
          <h4 v-if="sections.length > 1">{{ section.title }}</h4>
          <p>{{ section.message }}</p>
          <ul v-if="section.reasons?.length">
            <li v-for="reason in section.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </section>
      </div>
    </FloatingPopover>
  </div>
</template>

<style scoped>
.reader-notice {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 15;
}
.reader-notice-trigger {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: light-dark(#fff4d9, #443211);
  color: light-dark(#a65b00, #ffc567);
  border: 1px solid light-dark(#f5d49b, #805e27);
}
.arrival {
  animation: notice-arrival 800ms ease-out 3;
}
.reader-notice-trigger:focus-visible,
.notice-close:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: -2px;
}
.reader-notice-details {
  padding: 4px;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
h3 {
  flex: 1;
  font-weight: 600;
}
h4 {
  font-weight: 600;
  margin-bottom: 4px;
}
section + section {
  margin-top: 12px;
}
.notice-heading-icon {
  color: light-dark(#a65b00, #ffc567);
  flex-shrink: 0;
}
.notice-close {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 6px;
}
.notice-close:hover {
  background: var(--pt-canvas);
}
ul {
  list-style: disc;
  padding-left: 18px;
  margin-top: 8px;
}
@keyframes notice-arrival {
  from {
    box-shadow: 0 0 0 0 light-dark(#edaa4055, #ffc56744);
  }
  to {
    box-shadow: 0 0 0 12px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reader-notice-trigger {
    animation: none;
  }
}
</style>
