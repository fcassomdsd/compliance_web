import { defineStore } from 'pinia';
import { apiEntityCRUD, apiUsoapCeEvidenceReport } from '@/services/apiServices';

export const useUsoapEvidenceReportStore = defineStore('usoapEvidenceReport', {
  state: () => ({
    report: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchReport({ ce, year }) {
      this.loading = true;
      this.error = null;
      try {
        // The Type-2 (sampled-population) catalog lives in AtroCore, read
        // directly here (no Express hop needed for a read-only lookup, same
        // as providerHistoryStore.refreshProviderOptions), then translated
        // into the populationQueries the ce-evidence-report webscript
        // resolves against Alfresco.
        const { data } = await apiEntityCRUD('query', 'UsoapEvidenceExpectation', null, { deleted: false });
        const expectations = Array.isArray(data?.list) ? data.list : [];
        const populationQueries = expectations
          .filter((row) => row.criticalElementName === ce)
          .map((row) => ({
            pqCode: row.pqCode,
            artifactCategory: row.artifactCategoryName,
            specialtyCode: row.specialtyCode || undefined,
            monthsBack: row.dateRangeHintMonths || undefined,
          }));

        const { data: reportData } = await apiUsoapCeEvidenceReport({ ce, year, populationQueries });
        this.report = reportData || null;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    clearReport() {
      this.report = null;
    },
  },
});
