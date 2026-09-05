<template>
  <BaseManager :title="t('oversightPosture.title')">
    <div v-if="reportStore.error" class="error-message">{{ reportStore.error }}</div>

    <section class="card">
      <h3>{{ t('oversightPosture.scope') }}</h3>
      <form class="scope-form" @submit.prevent="loadPosture">
        <div class="input-group">
          <label for="providerId">{{ t('inspectionCadence.provider') }}</label>
          <select id="providerId" v-model="scope.providerId">
            <option value="">{{ t('oversightPosture.allProviders') }}</option>
            <option v-for="provider in reportStore.filterOptions.providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div class="input-group">
          <label for="locationId">{{ t('inspectionCadence.location') }}</label>
          <select id="locationId" v-model="scope.locationId">
            <option value="">{{ t('oversightPosture.allLocations') }}</option>
            <option v-for="location in reportStore.filterOptions.locations" :key="location.id" :value="location.id">
              {{ location.name }}
            </option>
          </select>
        </div>

        <div class="input-group">
          <label for="dateFrom">{{ t('oversightPosture.from') }}</label>
          <input id="dateFrom" v-model="dateFrom" type="date" />
        </div>

        <div class="input-group">
          <label for="dateTo">{{ t('oversightPosture.to') }}</label>
          <input id="dateTo" v-model="dateTo" type="date" />
        </div>

        <BaseButton type="submit" variant="primary" size="sm" :loading="reportStore.loading">{{ t('oversightPosture.applyFilters') }}</BaseButton>
        <BaseButton type="button" variant="secondary" size="sm" @click="resetFilters">{{ t('common.reset') }}</BaseButton>
      </form>
    </section>

    <LoadingSpinner :visible="reportStore.loading" :text="t('oversightPosture.loading')" />

    <template v-if="posture">
      <div class="panel-grid">
        <section class="card panel">
          <h3>{{ t('oversightPosture.findingsByStatus') }}</h3>
          <Bar :data="statusCountsChartData" :options="categoricalChartOptions" />
          <details class="table-toggle">
            <summary>{{ t('oversightPosture.viewAsTable') }}</summary>
            <table class="data-table">
              <thead><tr><th>{{ t('common.status') }}</th><th>{{ t('oversightPosture.count') }}</th></tr></thead>
              <tbody>
                <tr v-for="[status, count] in statusCountsEntries" :key="status">
                  <td>{{ status }}</td>
                  <td>{{ count }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <section class="card panel">
          <h3>{{ t('oversightPosture.severityTrend') }}</h3>
          <Line :data="severityTrendChartData" :options="severityTrendChartOptions" />
          <details class="table-toggle">
            <summary>{{ t('oversightPosture.viewAsTable') }}</summary>
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('oversightPosture.quarter') }}</th>
                  <th v-for="severity in severityTrendSeries" :key="severity">{{ severity }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="quarter in severityTrendQuarters" :key="quarter">
                  <td>{{ quarter }}</td>
                  <td v-for="severity in severityTrendSeries" :key="severity">
                    {{ posture.summary.severityTrend[quarter]?.[severity] || 0 }}
                  </td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <section class="card panel">
          <h3>{{ t('oversightPosture.overdueAging') }}</h3>
          <p class="stat-line">{{ t('oversightPosture.pastDeadline', { count: posture.summary.overdueAging.totalOverdue }) }}</p>
          <Bar :data="overdueAgingChartData" :options="categoricalChartOptions" />
          <details class="table-toggle">
            <summary>{{ t('oversightPosture.viewAsTable') }}</summary>
            <table class="data-table">
              <thead><tr><th>{{ t('oversightPosture.daysOverdue') }}</th><th>{{ t('oversightPosture.count') }}</th></tr></thead>
              <tbody>
                <tr v-for="[bucket, count] in overdueAgingEntries" :key="bucket">
                  <td>{{ bucket }}</td>
                  <td>{{ count }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <section class="card panel">
          <h3>{{ t('oversightPosture.capCycleTime') }}</h3>
          <p class="stat-tile">
            <span class="stat-number">{{ posture.summary.capCycleTime.averageDays ?? '—' }}</span>
            <span class="stat-label">{{ t('oversightPosture.capCycleAvgDays', { sampleSize: posture.summary.capCycleTime.sampleSize }) }}</span>
          </p>
          <p class="stat-note">{{ t('oversightPosture.capCycleNote') }}</p>
          <Bar :data="capAcceptanceChartData" :options="categoricalChartOptions" />
          <details class="table-toggle">
            <summary>{{ t('oversightPosture.viewAsTable') }}</summary>
            <table class="data-table">
              <thead><tr><th>{{ t('oversightPosture.acceptanceStatus') }}</th><th>{{ t('oversightPosture.count') }}</th></tr></thead>
              <tbody>
                <tr v-for="[status, count] in capAcceptanceEntries" :key="status">
                  <td>{{ status }}</td>
                  <td>{{ count }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <section class="card panel panel-wide">
          <h3>{{ t('oversightPosture.recurringFindings') }}</h3>
          <p v-if="posture.summary.recurrence.length === 0" class="stat-note">{{ t('oversightPosture.noRecurrence') }}</p>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>{{ t('inspectionCadence.location') }}</th>
                <th>{{ t('oversightPosture.requirementBreached') }}</th>
                <th>{{ t('oversightPosture.occurrences') }}</th>
                <th>{{ t('oversightPosture.findingIds') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in posture.summary.recurrence" :key="`${group.locationId}-${group.requirementBreached}`">
                <td>{{ group.locationName }}</td>
                <td>{{ group.requirementBreached }}</td>
                <td>{{ group.count }}</td>
                <td>{{ group.findingIds.join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card panel panel-wide">
          <h3>{{ t('oversightPosture.providerRanking') }}</h3>
          <p v-if="posture.summary.providerRanking.length === 0" class="stat-note">{{ t('oversightPosture.noOpenFindings') }}</p>
          <template v-else>
            <Bar :data="providerRankingChartData" :options="providerRankingChartOptions" />
            <details class="table-toggle">
              <summary>{{ t('oversightPosture.viewAsTable') }}</summary>
              <table class="data-table">
                <thead><tr><th>{{ t('inspectionCadence.provider') }}</th><th>{{ t('oversightPosture.openFindings') }}</th><th>{{ t('oversightPosture.openHighRiskFindings') }}</th></tr></thead>
                <tbody>
                  <tr v-for="entry in posture.summary.providerRanking" :key="entry.providerId">
                    <td>{{ entry.providerName }}</td>
                    <td>{{ entry.openFindings }}</td>
                    <td>{{ entry.openHighRiskFindings }}</td>
                  </tr>
                </tbody>
              </table>
            </details>
          </template>
        </section>
      </div>
    </template>
  </BaseManager>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bar, Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useReportStore } from '@/stores/reportStore';

ChartJS.register(BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

// Status colors mirror the semantic meaning already used by
// StatusBadge.vue's overdue variants, extended to the rest of the
// finding status state machine (compliance_web/docs/STYLE_GUIDE.md §12).
const STATUS_COLORS = {
  Open: '#9e9e9e',
  'CAP Submitted': '#42a5f5',
  'CAP Accepted': '#1e88e5',
  'In Progress': '#ff9800',
  'Pending Closure Review': '#e65100',
  Closed: '#4caf50',
  'CAP Overdue': '#e65100',
  'Solution Overdue': '#d32f2f',
  Overdue: '#d32f2f',
  Unknown: '#cfd8dc',
};

const SEVERITY_COLORS = {
  A: '#d32f2f',
  High: '#d32f2f',
  B: '#ff9800',
  Medium: '#ff9800',
  C: '#4caf50',
  Low: '#4caf50',
  Unknown: '#9e9e9e',
};

const OVERDUE_BUCKET_COLORS = {
  '0-30': '#fff3e0',
  '31-90': '#ff9800',
  '90+': '#e65100',
};

const CAP_ACCEPTANCE_COLORS = {
  Accepted: '#4caf50',
  'Pending review': '#ff9800',
  Rejected: '#d32f2f',
  Returned: '#e65100',
  Unknown: '#cfd8dc',
};

const { t } = useI18n();
const reportStore = useReportStore();
const scope = reactive({ providerId: '', locationId: '' });
const dateFrom = ref('');
const dateTo = ref('');

const posture = computed(() => reportStore.posture);

async function loadPosture() {
  reportStore.setFilter('providerId', scope.providerId || '');
  reportStore.setFilter('locationId', scope.locationId || '');
  reportStore.setFilter('dateFrom', dateFrom.value || '');
  reportStore.setFilter('dateTo', dateTo.value || '');
  await reportStore.fetchPostureReport();
}

function resetFilters() {
  scope.providerId = '';
  scope.locationId = '';
  dateFrom.value = '';
  dateTo.value = '';
  loadPosture();
}

onMounted(async () => {
  // Filter options come from the same unfiltered finding data the report
  // itself queries, so every dropdown value is guaranteed to be a real,
  // existing vso:providerId/vso:locationId rather than one a user has to
  // already know and type by hand.
  await reportStore.fetchFilterOptions();
  await loadPosture();
});

const categoricalChartOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, grid: { color: '#cfd8dc' } },
  },
};

const providerRankingChartOptions = {
  ...categoricalChartOptions,
  indexAxis: 'y',
};

const severityTrendChartOptions = {
  responsive: true,
  plugins: { legend: { display: true, position: 'bottom' } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, grid: { color: '#cfd8dc' } },
  },
};

const statusCountsEntries = computed(() => Object.entries(posture.value?.summary?.statusCounts || {}));

const statusCountsChartData = computed(() => {
  const entries = statusCountsEntries.value;
  return {
    labels: entries.map(([status]) => status),
    datasets: [
      {
        data: entries.map(([, count]) => count),
        backgroundColor: entries.map(([status]) => STATUS_COLORS[status] || STATUS_COLORS.Unknown),
        borderRadius: 4,
      },
    ],
  };
});

const severityTrendQuarters = computed(() => Object.keys(posture.value?.summary?.severityTrend || {}).sort());

const severityTrendSeries = computed(() => {
  const trend = posture.value?.summary?.severityTrend || {};
  const series = new Set();
  for (const bucket of Object.values(trend)) {
    Object.keys(bucket).forEach((severity) => series.add(severity));
  }
  return Array.from(series);
});

const severityTrendChartData = computed(() => {
  const trend = posture.value?.summary?.severityTrend || {};
  const quarters = severityTrendQuarters.value;
  return {
    labels: quarters,
    datasets: severityTrendSeries.value.map((severity) => ({
      label: severity,
      data: quarters.map((quarter) => trend[quarter]?.[severity] || 0),
      borderColor: SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown,
      backgroundColor: SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown,
      borderWidth: 2,
      pointRadius: 4,
      tension: 0,
    })),
  };
});

const overdueAgingEntries = computed(() => Object.entries(posture.value?.summary?.overdueAging?.buckets || {}));

const overdueAgingChartData = computed(() => {
  const entries = overdueAgingEntries.value;
  return {
    labels: entries.map(([bucket]) => bucket),
    datasets: [
      {
        data: entries.map(([, count]) => count),
        backgroundColor: entries.map(([bucket]) => OVERDUE_BUCKET_COLORS[bucket] || OVERDUE_BUCKET_COLORS['0-30']),
        borderRadius: 4,
      },
    ],
  };
});

const capAcceptanceEntries = computed(() =>
  Object.entries(posture.value?.summary?.capCycleTime?.acceptanceStatusCounts || {})
);

const capAcceptanceChartData = computed(() => {
  const entries = capAcceptanceEntries.value;
  return {
    labels: entries.map(([status]) => status),
    datasets: [
      {
        data: entries.map(([, count]) => count),
        backgroundColor: entries.map(([status]) => CAP_ACCEPTANCE_COLORS[status] || CAP_ACCEPTANCE_COLORS.Unknown),
        borderRadius: 4,
      },
    ],
  };
});

const providerRankingChartData = computed(() => {
  const ranking = posture.value?.summary?.providerRanking || [];
  return {
    labels: ranking.map((entry) => entry.providerName),
    datasets: [
      {
        label: 'Open high-risk findings',
        data: ranking.map((entry) => entry.openHighRiskFindings),
        backgroundColor: '#1e88e5',
        borderRadius: 4,
      },
    ],
  };
});
</script>

<style scoped>
.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.panel-wide {
  grid-column: 1 / -1;
}

.panel h3 {
  margin-top: 0;
  color: var(--color-primary-700);
}

.scope-form {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.scope-form .input-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.scope-form label {
  font-weight: 500;
  color: var(--color-primary-700);
}

.scope-form select,
.scope-form input[type='date'] {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  min-width: 200px;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0 0 var(--space-2);
}

.stat-number {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-primary-700);
}

.stat-label {
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.stat-line {
  font-weight: 600;
  color: var(--color-primary-700);
}

.stat-note {
  color: var(--color-gray-500);
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}

.table-toggle {
  margin-top: var(--space-4);
}

.table-toggle summary {
  cursor: pointer;
  color: var(--color-primary-700);
  font-weight: 500;
}
</style>
