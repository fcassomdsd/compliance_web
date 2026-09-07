<template>
  <BaseManager :title="t('usoapEvidenceReport.title')">
    <section class="card">
      <h3>{{ t('usoapEvidenceReport.lookUp') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="ceSelect">{{ t('usoapEvidenceReport.criticalElement') }}</label>
          <select id="ceSelect" v-model="ce">
            <option value="">{{ t('usoapTagPanel.selectPlaceholder') }}</option>
            <option v-for="option in CE_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="yearInput">{{ t('providerHistory.yearOptional') }}</label>
          <input id="yearInput" v-model="year" type="text" placeholder="e.g. 2026" />
        </div>
      </div>
      <BaseButton variant="primary" :disabled="!ce || usoapEvidenceReportStore.loading" @click="loadReport">{{ t('common.search') }}</BaseButton>
    </section>

    <p v-if="usoapEvidenceReportStore.error" class="error-message">{{ usoapEvidenceReportStore.error }}</p>

    <template v-if="usoapEvidenceReportStore.report">
      <section class="card">
        <h3>{{ t('usoapEvidenceReport.taggedEvidence') }}</h3>
        <p><strong>{{ t('providerHistory.totalRecords') }}</strong> {{ usoapEvidenceReportStore.report.summary?.total ?? 0 }}</p>
        <div class="split-grid">
          <div class="section-card">
            <h4 class="section-title">{{ t('usoapEvidenceReport.byPq') }}</h4>
            <ul class="kv-list">
              <li v-for="(count, pq) in usoapEvidenceReportStore.report.summary?.byPq" :key="pq">
                <span>{{ pq }}</span><span>{{ count }}</span>
              </li>
            </ul>
          </div>
          <div class="section-card">
            <h4 class="section-title">{{ t('usoapEvidenceReport.byArea') }}</h4>
            <ul class="kv-list">
              <li v-for="(count, area) in usoapEvidenceReportStore.report.summary?.byArea" :key="area">
                <span>{{ area }}</span><span>{{ count }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="usoapEvidenceReportStore.report.sampledPopulations?.length" class="card">
        <h3>{{ t('usoapEvidenceReport.sampledPopulations') }}</h3>
        <p class="hint">{{ t('usoapEvidenceReport.sampledPopulationsHint') }}</p>
        <div v-for="population in usoapEvidenceReportStore.report.sampledPopulations" :key="`${population.pqCode}-${population.artifactCategory}`" class="section-card population-card">
          <div class="population-header">
            <h4 class="section-title">{{ population.pqCode }} — {{ population.artifactCategory }}</h4>
            <span :class="['count-badge', population.candidateCount === 0 ? 'count-badge-warning' : '']">
              {{ population.candidateCount }} {{ t('usoapEvidenceReport.candidates') }}
            </span>
          </div>
          <p v-if="population.error" class="error-message">{{ population.error }}</p>
          <ul v-if="population.candidates?.length" class="candidate-list">
            <li v-for="candidate in population.candidates" :key="candidate.nodeRef">
              <span class="candidate-name">{{ candidate.name }}</span>
              <span class="candidate-meta">{{ candidate.path }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewCandidate(candidate)">{{ t('common.view') }}</BaseButton>
            </li>
          </ul>
        </div>
      </section>

      <section class="card">
        <h3>{{ t('usoapEvidenceReport.gaps') }}</h3>
        <table v-if="usoapEvidenceReportStore.report.summary?.gaps?.length" class="data-table">
          <thead>
            <tr>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('common.id') }}</th>
              <th>{{ t('usoapEvidenceReport.gap') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(gap, index) in usoapEvidenceReportStore.report.summary.gaps" :key="index">
              <td>{{ gap.type }}</td>
              <td>{{ gap.id || gap.pqCode || '-' }}</td>
              <td>{{ gap.gap }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="hint">{{ t('usoapEvidenceReport.noGaps') }}</p>
      </section>
    </template>

    <LoadingSpinner :visible="usoapEvidenceReportStore.loading" />
  </BaseManager>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useUsoapEvidenceReportStore } from '@/stores/usoapEvidenceReportStore';
import { apiUsoapCeEvidenceCandidateContentUrl } from '@/services/apiServices';

const { t } = useI18n();
const usoapEvidenceReportStore = useUsoapEvidenceReportStore();
const ce = ref('');
const year = ref('');

const CE_OPTIONS = ['CE-1', 'CE-2', 'CE-3', 'CE-4', 'CE-5', 'CE-6', 'CE-7', 'CE-8'];

function viewCandidate(candidate) {
  window.open(apiUsoapCeEvidenceCandidateContentUrl(candidate.nodeRef, candidate.name), '_blank', 'noopener');
}

async function loadReport() {
  if (!ce.value) {
    return;
  }
  try {
    await usoapEvidenceReportStore.fetchReport({ ce: ce.value, year: year.value.trim() || undefined });
  } catch (error) {
    console.error('USOAP CE evidence report failed:', error);
  }
}
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

.population-card {
  margin-bottom: var(--space-3);
}

.population-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.count-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: var(--text-sm);
  font-weight: 600;
  background: var(--color-gray-200);
  color: var(--color-gray-900);
  white-space: nowrap;
}

.count-badge-warning {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.candidate-list {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.candidate-list li {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--color-white);
}

.candidate-name {
  font-size: var(--text-sm);
  font-weight: 600;
}

.candidate-meta {
  font-size: var(--text-sm);
  color: var(--color-gray-500);
  overflow-wrap: anywhere;
}

.candidate-list li > button {
  align-self: flex-start;
  margin-top: var(--space-1);
}

.hint {
  font-size: var(--text-sm);
  color: var(--color-gray-500);
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
