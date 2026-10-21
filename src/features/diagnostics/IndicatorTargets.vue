<script setup lang="ts">
import { ref } from 'vue'
import type { Metric } from './recorder'
import { metricNames } from './presentation'
import { validTarget, type Target } from './indicators'
const emit = defineEmits<{
  apply: [metric: Metric, kind: 'operations' | 'pending', target: Target | null]
}>()
const metric = ref<Metric>('pdf.render')
const kind = ref<'operations' | 'pending'>('operations')
const attention = ref(200)
const critical = ref(1000)
const error = ref('')
function apply() {
  const target = { attentionMs: attention.value, criticalMs: critical.value }
  if (!validTarget(target)) {
    error.value =
      'Enter positive millisecond targets with critical greater than attention, up to 3,600,000 ms.'
    return
  }
  error.value = ''
  emit('apply', metric.value, kind.value, target)
}
</script>
<template>
  <form @submit.prevent="apply">
    <h3>Local provisional operation targets</h3>
    <p>
      Unconfigured by default; these are not accepted #16 budgets. Cold/warm/restore attribution is
      not yet recorded separately. Configure only a representative workload; changes restart the
      evaluation window.
    </p>
    <label
      >Operation<select v-model="metric">
        <option v-for="(name, key) in metricNames" :key="key" :value="key">{{ name }}</option>
      </select></label
    >
    <label
      >Rule<select v-model="kind">
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
