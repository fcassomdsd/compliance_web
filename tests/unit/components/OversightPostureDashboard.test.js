import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import OversightPostureDashboard from '@/views/OversightPostureDashboard.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useReportStore } from '@/stores/reportStore';

vi.mock('../../../src/stores/reportStore');
// jsdom has no real <canvas> 2D context, so vue-chartjs's real Bar/Line
// components fail to render a chart; stub the whole module rather than
// relying on name-based component stubbing.
vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div class="chart-stub-bar" />' },
  Line: { template: '<div class="chart-stub-line" />' },
}));

function buildPosture(overrides = {}) {
  return {
    success: true,
    timestamp: '2026-04-03T10:00:00.000Z',
    filters: { providerId: '', locationId: '', dateFrom: '', dateTo: '' },
    summary: {
      statusCounts: { Open: 2, Closed: 1 },
      severityTrend: { '2026-Q1': { A: 1 }, '2026-Q2': { B: 2 } },
      overdueAging: { totalOverdue: 1, buckets: { '0-30': 1, '31-90': 0, '90+': 0 } },
      capCycleTime: { averageDays: 12, sampleSize: 3, acceptanceStatusCounts: { Accepted: 2 }, approximation: true },
      recurrence: [{ locationId: 'LOC-01', locationName: 'Main Airport', requirementBreached: 'REQ-1', count: 2, findingIds: ['F-1', 'F-2'] }],
      providerRanking: [{ providerId: 'PR-01', providerName: 'Provider 1', openFindings: 3, openHighRiskFindings: 1 }],
    },
    ...overrides,
  };
}

describe('OversightPostureDashboard.vue', () => {
  let mockReportStore;

  const mountComponent = () => mount(OversightPostureDashboard, {
    global: {
      stubs: {
        BaseManager: { template: '<div><slot /></div>' },
      },
    },
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mockReportStore = {
      posture: buildPosture(),
      loading: false,
      error: null,
      filterOptions: {
        providers: [{ id: 'PR-01', name: 'Provider 1' }],
        locations: [{ id: 'LOC-01', name: 'Main Airport' }],
      },
      filterOptionsLoading: false,
      filters: { providerId: '', locationId: '', dateFrom: '', dateTo: '' },
      setFilter: vi.fn(),
      fetchPostureReport: vi.fn().mockResolvedValue(undefined),
      fetchFilterOptions: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(useReportStore).mockReturnValue(mockReportStore);
  });

  it('fetches filter options and the posture report on mount', async () => {
    mountComponent();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockReportStore.fetchFilterOptions).toHaveBeenCalled();
    expect(mockReportStore.fetchPostureReport).toHaveBeenCalled();
  });

  it('renders provider and location options as dropdown choices', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const providerOptions = wrapper.find('#providerId').findAll('option').map((o) => o.text());
    const locationOptions = wrapper.find('#locationId').findAll('option').map((o) => o.text());

    expect(providerOptions).toEqual(['All providers', 'Provider 1']);
    expect(locationOptions).toEqual(['All locations', 'Main Airport']);
  });

  it('renders all six metric panels when data is present', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Findings by status');
    expect(wrapper.text()).toContain('Severity trend');
    expect(wrapper.text()).toContain('Overdue aging');
    expect(wrapper.text()).toContain('CAP cycle time');
    expect(wrapper.text()).toContain('Recurring findings');
    expect(wrapper.text()).toContain('Provider ranking');
    expect(wrapper.text()).toContain('Main Airport');
    expect(wrapper.text()).toContain('Provider 1');
  });

  it('shows the error panel when the store has an error', async () => {
    mockReportStore.error = 'Unable to fetch posture report';
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.error-message').text()).toContain('Unable to fetch posture report');
  });

  it('shows the loading spinner while fetching', async () => {
    mockReportStore.loading = true;
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const spinner = wrapper.findComponent(LoadingSpinner);
    expect(spinner.props('visible')).toBe(true);
  });

  it('loadPosture applies the current scope and date range to the store filters', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.scope.providerId = 'PR-02';
    wrapper.vm.scope.locationId = 'LOC-02';
    wrapper.vm.dateFrom = '2026-01-01';
    wrapper.vm.dateTo = '2026-06-30';

    await wrapper.vm.loadPosture();

    expect(mockReportStore.setFilter).toHaveBeenCalledWith('providerId', 'PR-02');
    expect(mockReportStore.setFilter).toHaveBeenCalledWith('locationId', 'LOC-02');
    expect(mockReportStore.setFilter).toHaveBeenCalledWith('dateFrom', '2026-01-01');
    expect(mockReportStore.setFilter).toHaveBeenCalledWith('dateTo', '2026-06-30');
    expect(mockReportStore.fetchPostureReport).toHaveBeenCalledTimes(2);
  });

  it('renders a no-recurrence message when the recurrence list is empty', async () => {
    mockReportStore.posture = buildPosture({ summary: { ...buildPosture().summary, recurrence: [] } });
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No repeat findings');
  });
});
