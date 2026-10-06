<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { PdfBookmark } from '../../services/pdf-bookmarks'

const props = defineProps<{
  bookmarks: readonly PdfBookmark[]
  available: boolean
  busy: boolean
  loading: boolean
  notice: string
  currentPage: number
  totalPages: number
  add: (name: string) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}>()
const emit = defineEmits<{ navigate: [bookmark: PdfBookmark]; retry: [] }>()
const name = ref('')
const editing = ref<string | null>(null)
const editName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const editInput = ref<HTMLInputElement | null>(null)

async function cancelRename() {
  editing.value = null
  await nextTick()
  nameInput.value?.focus()
}
async function addBookmark() {
  if (await props.add(name.value.trim() || `Page ${props.currentPage}`)) name.value = ''
}
async function startRename(bookmark: PdfBookmark) {
  editing.value = bookmark.id
  editName.value = bookmark.name
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}
async function renameBookmark(id: string) {
  if (!editName.value.trim()) return
  if (await props.rename(id, editName.value)) {
    editing.value = null
    await nextTick()
    nameInput.value?.focus()
  }
}
async function removeBookmark(id: string) {
  if (await props.remove(id)) {
    await nextTick()
    nameInput.value?.focus()
  }
}
</script>

<template>
  <section
    class="min-h-0 flex-1 overflow-auto overscroll-contain p-3"
    aria-labelledby="pdf-bookmarks-title"
  >
    <h3 id="pdf-bookmarks-title" class="sr-only">Bookmarks</h3>
    <p v-if="loading" role="status" class="mb-3 text-sm text-muted">Loading bookmarks…</p>
    <p
      v-if="notice"
      role="status"
      aria-live="polite"
      class="mb-3 text-sm leading-relaxed text-muted"
    >
      {{ notice }}
    </p>
    <template v-if="!available && !loading">
      <p v-if="!notice" class="mb-3 text-sm text-muted">
        Bookmarks need an available, unambiguous saved document identity. You can continue reading.
      </p>
      <button
        v-else
        type="button"
        class="bookmark-button mb-3"
        :disabled="busy"
        @click="emit('retry')"
      >
        Retry bookmarks
      </button>
    </template>
    <form class="mb-4 space-y-2" @submit.prevent="addBookmark">
      <label for="pdf-bookmark-name" class="block text-xs font-medium">Bookmark name</label>
      <input
        id="pdf-bookmark-name"
        ref="nameInput"
        v-model="name"
        type="text"
        maxlength="120"
        :placeholder="`Page ${currentPage}`"
        :disabled="!available || busy"
        class="bookmark-input"
      />
      <button
        type="submit"
        class="bookmark-button w-full"
        :disabled="!available || busy || bookmarks.length >= 500"
      >
        Save current place
      </button>
      <p v-if="bookmarks.length >= 500" class="text-xs text-muted">
        You have 500 bookmarks. Remove one to save another place.
      </p>
    </form>
    <p v-if="available && !bookmarks.length" class="text-sm text-muted">
      No bookmarks yet. Save your current place to begin.
    </p>
    <ul v-else class="space-y-3">
      <li
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        class="rounded-lg border border-line p-3"
      >
        <form
          v-if="editing === bookmark.id"
          class="space-y-2"
          @submit.prevent="renameBookmark(bookmark.id)"
          @keydown.esc.stop.prevent="cancelRename"
        >
          <label :for="`rename-${bookmark.id}`" class="block text-xs font-medium"
            >New bookmark name</label
          >
          <input
            :id="`rename-${bookmark.id}`"
            :ref="
              (element) => {
                editInput = element as HTMLInputElement | null
              }
            "
            v-model="editName"
            type="text"
            maxlength="120"
            required
            :disabled="busy"
            class="bookmark-input"
          />
          <div class="flex flex-wrap gap-2">
            <button type="submit" class="bookmark-button" :disabled="busy || !editName.trim()">
              Save name
            </button>
            <button type="button" class="bookmark-button" :disabled="busy" @click="cancelRename">
              Cancel rename
            </button>
          </div>
        </form>
        <template v-else>
          <button
            type="button"
            class="pt-list-entry min-h-10 w-full break-words rounded-md text-left text-sm font-medium text-brand focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
            :aria-label="`Go to bookmark ${bookmark.name}`"
            :disabled="!available || busy || bookmark.anchor.page > totalPages"
            @click="emit('navigate', bookmark)"
          >
            {{ bookmark.name }}
            <span class="mt-1 block text-xs font-normal text-muted"
              >Page {{ bookmark.anchor.page }}</span
            >
          </button>
          <p v-if="bookmark.anchor.page > totalPages" class="mt-1 text-xs text-muted">
            This saved page is unavailable.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              class="bookmark-button"
              :aria-label="`Rename bookmark ${bookmark.name}`"
              :disabled="!available || busy"
              @click="startRename(bookmark)"
            >
              Rename
            </button>
            <button
              type="button"
              class="bookmark-button"
              :aria-label="`Remove bookmark ${bookmark.name}`"
              :disabled="!available || busy"
              @click="removeBookmark(bookmark.id)"
            >
              Remove
            </button>
          </div>
        </template>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.bookmark-input {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--pt-line);
  border-radius: 0.5rem;
  background: var(--pt-canvas);
  padding: 0.6rem;
  font-size: 0.875rem;
}
.bookmark-button {
  min-height: 2.5rem;
  border: 1px solid var(--pt-line);
  border-radius: 0.5rem;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.bookmark-button:hover {
  background: var(--pt-canvas);
}
.bookmark-button:disabled,
.bookmark-input:disabled {
  opacity: 0.5;
}
.bookmark-button:focus-visible,
.bookmark-input:focus-visible {
  outline: 2px solid var(--pt-brand);
  outline-offset: 2px;
}
</style>
