<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { profileNames, profileDescription, type OperationProfile } from './operation-profiles'
import { validTarget, type Target, type IndicatorConfig } from './indicators'
const props = defineProps<{ config?: IndicatorConfig }>()
const emit = defineEmits<{
  apply: [metric: OperationProfile, kind: 'operations' | 'pending', target: Target | null]
}>()
const metric = ref<OperationProfile>('pdf.render')
const kind = ref<'operations' | 'pending'>('operations')
const attention = ref<number | ''>('')
const critical = ref<number | ''>('')
const error = ref('')
const selectedTarget = computed(() => props.config?.[kind.value][metric.value])
watch(
  [metric, kind, () => props.config],
  () => {
    attention.value = selectedTarget.value?.attentionMs ?? ''
    critical.value = selectedTarget.value?.criticalMs ?? ''
    error.value = ''
  },
  { immediate: true },
)
function apply() {
  const target = { attentionMs: attention.value, criticalMs: critical.value }
  if (
    typeof target.attentionMs !== 'number' ||
    typeof target.criticalMs !== 'number' ||
    !validTarget({ attentionMs: Number(target.attentionMs), criticalMs: Number(target.criticalMs) })
  ) {
    error.value =
      'Enter positive millisecond targets with critical greater than attention, up to 3,600,000 ms.'
    return
  }
  error.value = ''
  emit('apply', metric.value, kind.value, {
    attentionMs: Number(target.attentionMs),
    criticalMs: Number(target.criticalMs),
  })
}
</script>
<template>
  <form @submit.prevent="apply">
    <h3>Local provisional operation targets</h3>
    <p>
      Unconfigured by default; these are not accepted #16 budgets. Configure each workload
      separately; changes restart the evaluation window. Version 2 keeps cold, saved-workspace,
      expiry and warm selection targets independent.
    </p>
    <label
      >Operation<select v-model="metric" aria-label="Operation">
        <option v-for="(name, key) in profileNames" :key="key" :value="key">{{ name }}</option>
      </select></label
    >
    <p>{{ profileDescription(metric) }}</p>
    <p role="status">
      {{
        selectedTarget
          ? `Configured: attention ${selectedTarget.attentionMs} ms · critical ${selectedTarget.criticalMs} ms`
          : 'Selected target is unconfigured'
      }}
    </p>
    <label
      >Rule<select v-model="kind" aria-label="Rule">
        <option value="operations">Completed duration</option>
        <option value="pending">Pending age</option>
      </select></label
    >
    <label
      >Attention (ms)<input v-model.number="attention" type="number" min="1" max="3600000" required
    /></label>
    <label
      >Critical (ms)<input v-model.number="critical" type="number" min="1" max="3600000" required
    /></label>
    <p v-if="error" role="alert">{{ error }}</p>
    <div>
      <button type="submit">Apply provisional target</button
      ><button type="button" @click="emit('apply', metric, kind, null)">
        Remove selected target
      </button>
    </div>
  </form>
</template>
<style scoped>
form {
  display: grid;
  gap: 10px;
}
h3 {
  font-weight: 600;
}
label {
  display: grid;
  gap: 4px;
}
input,
select,
button {
  border: 1px solid var(--pt-line);
  border-radius: 6px;
  padding: 8px;
  background: var(--pt-panel);
  color: var(--pt-ink);
  min-width: 0;
}
form > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
[role='alert'] {
  color: var(--pt-ink);
  font-weight: 600;
}
</style>
