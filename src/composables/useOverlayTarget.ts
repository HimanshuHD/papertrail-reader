import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
/** Keep overlays visible when a reader enters native fullscreen. */
export function useOverlayTarget() {
  const target = shallowRef<Element>(document.fullscreenElement ?? document.body)
  const update = () => {
    target.value = document.fullscreenElement ?? document.body
  }
  onMounted(() => document.addEventListener('fullscreenchange', update))
  onBeforeUnmount(() => document.removeEventListener('fullscreenchange', update))
  return target
}
