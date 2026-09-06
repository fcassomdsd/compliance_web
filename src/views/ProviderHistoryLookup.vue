<template>
  <BaseManager :title="t('providerHistory.title')">
    <section class="card">
      <h3>{{ t('providerHistory.lookUp') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="providerSelect">{{ t('inspectionPlan.provider') }}</label>
          <select id="providerSelect" v-model="providerId">
            <option value="">{{ t('inspectionPlan.selectProvider') }}</option>
            <option v-for="provider in providerHistoryStore.providerOptions" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="yearInput">{{ t('providerHistory.yearOptional') }}</label>
          <input id="yearInput" v-model="year" type="text" placeholder="e.g. 2026" />
        </div>
      </div>
      <BaseButton variant="primary" :disabled="!providerId || providerHistoryStore.loading" @click="loadReport">{{ t('common.search') }}</BaseButton>
    </section>

    <p v-if="providerHistoryStore.error" class="error-message">{{ providerHistoryStore.error }}</p>

    <template v-if="providerHistoryStore.report">
      <section class="card">
        <h3>{{ providerHistoryStore.report.providerName || providerHistoryStore.report.providerId }}</h3>
        <p><strong>{{ t('providerHistory.yearScope') }}</strong> {{ providerHistoryStore.report.year }}</p>
        <p><strong>{{ t('providerHistory.totalRecords') }}</strong> {{ providerHistoryStore.report.summary?.total ?? 0 }}</p>

        <div class="split-grid">
          <div class="section-card">
            <h4 class="section-title">{{ t('providerHistory.byType') }}</h4>
            <ul class="kv-list">
              <li v-for="(count, type) in providerHistoryStore.report.summary?.byType" :key="type">
                <span>{{ type }}</span><span>{{ count }}</span>
              </li>
            </ul>
          </div>
          <div class="section-card">
            <h4 class="section-title">{{ t('common.status') }}</h4>
            <ul class="kv-list">
              <li v-for="(count, status) in providerHistoryStore.report.summary?.byStatus" :key="status">
                <span>{{ status }}</span><span>{{ count }}</span>
              </li>
            </ul>
          </div>
          <div class="section-card">
            <h4 class="section-title">{{ t('providerHistory.byLocation') }}</h4>
            <ul class="kv-list">
              <li v-for="(count, location) in providerHistoryStore.report.summary?.byLocation" :key="location">
                <span>{{ location }}</span><span>{{ count }}</span>
              </li>
            </ul>
          </div>
          <div class="section-card">
            <h4 class="section-title">{{ t('providerHistory.byYear') }}</h4>
            <ul class="kv-list">
              <li v-for="entry in providerHistoryStore.report.summary?.byYear" :key="entry.year">
                <span>{{ entry.year }}</span><span>{{ entry.count }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="providerHistoryStore.report.summary?.openFindings?.length" class="card">
        <h3>{{ t('providerHistory.openFindings') }}</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('providerHistory.table.findingId') }}</th>
              <th>{{ t('common.status') }}</th>
              <th>{{ t('providerHistory.table.inspection') }}</th>
              <th>{{ t('providerHistory.table.resolutionDeadline') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in providerHistoryStore.report.summary.openFindings" :key="item.findingId">
              <td>{{ item.findingId }}</td>
              <td>{{ item.findingStatus }}</td>
              <td>{{ item.inspectionId || '-' }}</td>
              <td>{{ formatDate(item.resolutionDeadline) || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h3>{{ t('providerHistory.recordsByInspection') }}</h3>
        <div v-for="(items, inspectionId) in providerHistoryStore.report.byInspection" :key="inspectionId" class="sub-section">
          <h4>{{ inspectionId }}</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('common.type') }}</th>
                <th>{{ t('providerHistory.table.reference') }}</th>
                <th>{{ t('common.status') }}</th>
                <th>{{ t('common.date') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in items" :key="index">
                <td>{{ item.type }}</td>
                <td>{{ item.findingId || item.capId || item.followUpId || item.itemId || item.name || '-' }}</td>
                <td>{{ item.status || '-' }}</td>
                <td>{{ formatDate(item.dateForYear) || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <LoadingSpinner :visible="providerHistoryStore.loading" />
  </BaseManager>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useProviderHistoryStore } from '@/stores/providerHistoryStore';
import { formatDate } from '@/utils/formatDate';

const { t } = useI18n();
const providerHistoryStore = useProviderHistoryStore();
const providerId = ref('');
const year = ref('');

async function loadReport() {
  if (!providerId.value) {
    return;
  }
  try {
    await providerHistoryStore.fetchReport({ providerId: providerId.value, year: year.value.trim() || undefined });
  } catch (error) {
    console.error('Provider history report failed:', error);
  }
}

onMounted(async () => {
  await providerHistoryStore.refreshProviderOptions();
});
</script>

<style scoped>
.card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-white);
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-grid input,
.form-grid select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-gray-900);
  box-sizing: border-box;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.split-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.section-card {
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-gray-100);
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-primary-700);
}

.kv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.kv-list li {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.sub-section {
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
}

.error-message {
  color: var(--color-error-700);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
