import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUsoapEvidenceReportStore } from '@/stores/usoapEvidenceReportStore';
import { apiEntityCRUD, apiUsoapCeEvidenceReport } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('usoapEvidenceReportStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useUsoapEvidenceReportStore();
  });

  it('fetchReport builds populationQueries from CE-matching expectations and stores the report', async () => {
    vi.mocked(apiEntityCRUD).mockResolvedValue({
      data: {
        list: [
          { pqCode: 'PQ 8.403', artifactCategoryName: 'OversightPlan', criticalElementName: 'CE-7', specialtyCode: 'AGA', dateRangeHintMonths: 24 },
          { pqCode: 'PQ 8.048', artifactCategoryName: 'CAPExecution', criticalElementName: 'CE-8', specialtyCode: 'AGA', dateRangeHintMonths: 24 },
        ],
      },
    });
    vi.mocked(apiUsoapCeEvidenceReport).mockResolvedValue({
      data: { success: true, ce: 'CE-7', sampledPopulations: [{ pqCode: 'PQ 8.403', candidateCount: 3 }] },
    });

    await store.fetchReport({ ce: 'CE-7', year: '2026' });

    expect(apiEntityCRUD).toHaveBeenCalledWith('query', 'UsoapEvidenceExpectation', null, { deleted: false });
    expect(apiUsoapCeEvidenceReport).toHaveBeenCalledWith({
      ce: 'CE-7',
      year: '2026',
      populationQueries: [
        { pqCode: 'PQ 8.403', artifactCategory: 'OversightPlan', specialtyCode: 'AGA', monthsBack: 24 },
      ],
    });
    expect(store.report.sampledPopulations).toEqual([{ pqCode: 'PQ 8.403', candidateCount: 3 }]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchReport captures failure from the catalog lookup', async () => {
    vi.mocked(apiEntityCRUD).mockRejectedValue(new Error('catalog lookup failed'));

    await expect(store.fetchReport({ ce: 'CE-7' })).rejects.toThrow('catalog lookup failed');
    expect(store.error).toBe('catalog lookup failed');
    expect(store.loading).toBe(false);
  });

  it('fetchReport captures failure from the report call', async () => {
    vi.mocked(apiEntityCRUD).mockResolvedValue({ data: { list: [] } });
    vi.mocked(apiUsoapCeEvidenceReport).mockRejectedValue(new Error('report failed'));

    await expect(store.fetchReport({ ce: 'CE-7' })).rejects.toThrow('report failed');
    expect(store.error).toBe('report failed');
  });

  it('clearReport resets the report to null', async () => {
    vi.mocked(apiEntityCRUD).mockResolvedValue({ data: { list: [] } });
    vi.mocked(apiUsoapCeEvidenceReport).mockResolvedValue({ data: { success: true } });
    await store.fetchReport({ ce: 'CE-7' });
    expect(store.report).not.toBeNull();

    store.clearReport();
    expect(store.report).toBeNull();
  });
});
