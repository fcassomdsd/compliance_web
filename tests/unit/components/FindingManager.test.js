import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FindingManager from '@/views/FindingManager.vue';
import { useFindingStore } from '@/stores/findingStore';

vi.mock('../../../src/stores/findingStore');
vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
}));

describe('FindingManager.vue', () => {
  let mockFindingStore;
  let mockRouter;

  const mountComponent = () => mount(FindingManager, {
    global: {
      stubs: {
        BaseManager: { template: '<div><slot /></div>' },
      },
    },
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    const { useRouter } = await import('vue-router');
    mockRouter = { push: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(mockRouter);

    mockFindingStore = {
      findings: [
        {
          findingId: 'F-1',
          findingLevel: 'High',
          storedStatus: 'Open',
          effectiveStatus: 'Overdue',
          statusDivergence: true,
          submissionDeadline: '2026-03-01',
        },
      ],
      selectedFinding: null,
      loading: false,
      error: null,
      setFilter: vi.fn(),
      fetchFindings: vi.fn().mockResolvedValue(undefined),
      fetchFindingDetail: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(useFindingStore).mockReturnValue(mockFindingStore);
  });

  it('loads findings on mount and renders table row', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(mockFindingStore.fetchFindings).toHaveBeenCalled();
    expect(wrapper.text()).toContain('F-1');
    expect(wrapper.find('.divergence-badge').exists()).toBe(true);
  });

  it('loadFindings maps filters to store and fetches', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.filters.status = 'Open';
    wrapper.vm.filters.inspectionId = 'INS-1';
    wrapper.vm.filters.providerId = 'PROV-1';
    wrapper.vm.filters.overdueOnly = true;

    await wrapper.vm.loadFindings();

    expect(mockFindingStore.setFilter).toHaveBeenCalledWith('status', 'Open');
    expect(mockFindingStore.setFilter).toHaveBeenCalledWith('inspectionId', 'INS-1');
    expect(mockFindingStore.setFilter).toHaveBeenCalledWith('providerId', 'PROV-1');
    expect(mockFindingStore.setFilter).toHaveBeenCalledWith('overdueOnly', true);
    expect(mockFindingStore.fetchFindings).toHaveBeenCalledTimes(2);
  });

  it('viewDetail fetches finding detail', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.viewDetail('F-1');
    expect(mockFindingStore.fetchFindingDetail).toHaveBeenCalledWith('F-1');
  });

  it('goToCaps navigates to corrective action manager with query', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.goToCaps('F-7');
    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'correctiveActions', query: { findingId: 'F-7' } });
  });

  it('goToFollowUps navigates to follow-up manager with query', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.goToFollowUps('F-8');
    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'followUps', query: { findingId: 'F-8' } });
  });

  it('renders detail panel and warning text for selected finding divergence', async () => {
    mockFindingStore.selectedFinding = {
      findingId: 'F-2',
      description: 'Issue found',
      requirementBreached: 'REG-1',
      openedDate: '2026-01-02',
      lastStatusChange: '2026-02-03',
      statusDivergence: true,
    };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Finding Detail: F-2');
    expect(wrapper.text()).toContain('Issue found');
    expect(wrapper.find('.warning-text').exists()).toBe(true);
  });

  it('shows error panel when store has error', async () => {
    mockFindingStore.error = 'Unable to fetch findings';
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.error-message').text()).toContain('Unable to fetch findings');
  });

  it('triggers loadFindings and viewDetail from UI buttons', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const refreshBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Refresh');
    const viewBtn = wrapper.findAll('button').find((btn) => btn.text() === 'View');

    await refreshBtn.trigger('click');
    await viewBtn.trigger('click');

    expect(mockFindingStore.fetchFindings).toHaveBeenCalled();
    expect(mockFindingStore.fetchFindingDetail).toHaveBeenCalledWith('F-1');
  });

  it('triggers CAP navigation from detail panel button', async () => {
    mockFindingStore.selectedFinding = {
      findingId: 'F-9',
      description: 'Needs CAP',
      requirementBreached: 'REG-X',
      openedDate: '2026-02-01',
      lastStatusChange: '2026-02-15',
      statusDivergence: false,
    };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const openCapsBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Open CAP Manager');
    await openCapsBtn.trigger('click');

    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'correctiveActions', query: { findingId: 'F-9' } });
  });

  it('triggers follow-up navigation from row and detail actions', async () => {
    mockFindingStore.selectedFinding = {
      findingId: 'F-9',
      description: 'Needs follow-up',
      requirementBreached: 'REG-X',
      openedDate: '2026-02-01',
      lastStatusChange: '2026-02-15',
      statusDivergence: false,
    };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const followUpButtons = wrapper.findAll('button').filter((btn) =>
      btn.text() === 'Manage Follow-ups' || btn.text() === 'Open Follow-up Manager'
    );

    await followUpButtons[0].trigger('click');
    await followUpButtons[1].trigger('click');

    expect(mockRouter.push).toHaveBeenNthCalledWith(1, { name: 'followUps', query: { findingId: 'F-1' } });
    expect(mockRouter.push).toHaveBeenNthCalledWith(2, { name: 'followUps', query: { findingId: 'F-9' } });
  });
});
