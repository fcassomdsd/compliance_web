import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import UsoapEvidenceReport from '@/views/UsoapEvidenceReport.vue';
import { useUsoapEvidenceReportStore } from '@/stores/usoapEvidenceReportStore';
import { apiUsoapCeEvidenceCandidateContentUrl } from '@/services/apiServices';

vi.mock('../../../src/stores/usoapEvidenceReportStore');
vi.mock('../../../src/services/apiServices.js');

describe('UsoapEvidenceReport.vue', () => {
  const mountComponent = () =>
    mount(UsoapEvidenceReport, {
      global: {
        stubs: {
          BaseManager: { template: '<div><slot /></div>' },
          BaseButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
          LoadingSpinner: true,
        },
      },
    });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    vi.mocked(useUsoapEvidenceReportStore).mockReturnValue({
      loading: false,
      error: null,
      report: {
        summary: { total: 1, byPq: {}, byArea: {}, gaps: [] },
        sampledPopulations: [
          {
            pqCode: 'PQ 8.403',
            artifactCategory: 'OversightPlan',
            candidateCount: 1,
            candidates: [{ nodeRef: 'workspace://SpacesStore/abc-123', name: 'Plan.pdf', path: '/Documentos/Plan.pdf' }],
          },
        ],
      },
      fetchReport: vi.fn(),
      clearReport: vi.fn(),
    });

    vi.mocked(apiUsoapCeEvidenceCandidateContentUrl).mockReturnValue('http://example.test/candidate-content');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the candidate content URL when View is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

    const wrapper = mountComponent();
    const viewButton = wrapper.findAll('button').find((b) => b.text() === 'View');
    expect(viewButton).toBeDefined();

    await viewButton.trigger('click');

    expect(apiUsoapCeEvidenceCandidateContentUrl).toHaveBeenCalledWith('workspace://SpacesStore/abc-123', 'Plan.pdf');
    expect(openSpy).toHaveBeenCalledWith('http://example.test/candidate-content', '_blank', 'noopener');
  });
});
