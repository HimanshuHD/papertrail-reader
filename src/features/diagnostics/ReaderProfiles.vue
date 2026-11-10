<script setup lang="ts">
import { computed } from 'vue'
import type { InvestigationSnapshot } from './resource-investigation'
import type { IndicatorConfig } from './indicators'
import { readerProfileStats } from './operation-profiles'
import { measurement } from './presentation'
const props = defineProps<{ snapshot: InvestigationSnapshot; config: IndicatorConfig }>()
const rows = computed(() => readerProfileStats(props.snapshot))
</script>
<template>
  <section aria-label="Reader lifecycle profiles">
    <h3>Reader lifecycle profiles</h3>
    <p>
      Retained completed work, separately for each lifecycle. These counts are not a recent-window
      health pass. p95 requires 20 completions per profile. Configure provisional targets in
      Technical details.
    </p>
    <div
      class="profile-table"
      role="region"
      aria-label="Scrollable reader lifecycle durations"
      tabindex="0"
    >
      <table>
        <caption>
          Retained reader lifecycle durations (ms)
        </caption>
        <thead>
          <tr>
            <th scope="col">Profile</th>
            <th scope="col">Count</th>
            <th scope="col">Last</th>
            <th scope="col">Median</th>
            <th scope="col">p95</th>
            <th scope="col">Worst</th>
            <th scope="col">Targets</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.metric">
            <th scope="row">
              {{ row.name }}<small>{{ row.cancelled }} cancelled · {{ row.failed }} failed</small>
            </th>
            <td>{{ row.count }}</td>
            <td>{{ measurement(row.last) }}</td>
            <td>{{ measurement(row.median) }}</td>
            <td>{{ row.p95 === null ? `Collecting (${row.count}/20)` : measurement(row.p95) }}</td>
            <td>{{ measurement(row.worst) }}</td>
            <td>
              {{ config.operations[row.metric] ? 'Duration configured' : 'Duration unconfigured'
              }}<small>{{
                config.pending[row.metric] ? 'Pending age configured' : 'Pending age unconfigured'
              }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Warm selection dispatch measures synchronous selection work, not browser paint or
      first-readable latency. Cold means a new reader instance, not cleared system caches.
      Restoration includes saved-workspace restoration or expiry recreation, as labelled.
    </p>
  </section>
</template>
<style scoped>
section {
  margin-top: 20px;
}
h3 {
  font-weight: 600;
}
p {
  margin: 8px 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.profile-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
caption {
  text-align: left;
  padding: 8px 0;
}
th,
td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--pt-line);
}
small {
  display: block;
  font-weight: 400;
  color: var(--pt-muted);
}
</style>
