import { shallowRef } from 'vue'
export type Toast = { id: number; message: string }
export const toasts = shallowRef<Toast[]>([])
let sequence = 0
const timers = new Map<number, ReturnType<typeof setTimeout>>()
export function dismissToast(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts.value = toasts.value.filter((item) => item.id !== id)
}
export function showToast(message: string) {
  const id = ++sequence
  if (toasts.value.length >= 3) dismissToast(toasts.value[0]!.id)
  toasts.value = [...toasts.value, { id, message }]
  timers.set(
    id,
    setTimeout(() => dismissToast(id), 4500),
  )
}
