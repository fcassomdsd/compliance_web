import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import UsoapDirectTagPanel from '@/components/UsoapDirectTagPanel.vue';
import { useUsoapDirectTagStore } from '@/stores/usoapDirectTagStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('../../../src/stores/usoapDirectTagStore');
vi.mock('../../../src/stores/authStore');

describe('UsoapDirectTagPanel.vue', () => {
  let mockStore;

  const mountComponent = (props = {}) => mount(UsoapDirectTagPanel, {
    props: { nodeId: 'node-1', ...props },
    global: {
      stubs: {
        BaseButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
      },
    },
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mockStore = {
      loading: false,
      error: null,
      candidatePqs: vi.fn().mockReturnValue([
        { id: 'pq-1', code: 'PQ 8.315', texto: 'Verificar los requisitos nacionales de instrucción' },
        { id: 'pq-2', code: 'PQ 8.403', texto: 'Examinar el programa y el plan de vigilancia' },
      ]),
      ensureProtocolQuestionsLoaded: vi.fn().mockResolvedValue(undefined),
      applyDirectTag: vi.fn().mockResolvedValue({ success: true, usoapTagSource: 'Direct' }),
    };
    vi.mocked(useUsoapDirectTagStore).mockReturnValue(mockStore);
    vi.mocked(useAuthStore).mockReturnValue({ csrfToken: 'csrf-token' });
  });

  it('loads the protocol question catalog on mount', () => {
    mountComponent();
    expect(mockStore.ensureProtocolQuestionsLoaded).toHaveBeenCalledTimes(1);
  });

  it('populates the PQ dropdown from the store (pre-filtered by CE/area)', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    // The PQ select is the multi-select field; assert its options come
    // straight from the store's candidatePqs getter.
    const pqSelect = wrapper.findAll('select').find((s) => s.attributes('multiple') !== undefined);
    const pqOptions = pqSelect.findAll('option');
    expect(pqOptions).toHaveLength(2);
    expect(pqOptions[0].text()).toContain('PQ 8.315');
    expect(pqOptions[1].text()).toContain('PQ 8.403');
  });

  it('disables Apply Tag until a CE, area, or PQ is selected', () => {
    const wrapper = mountComponent();
    const applyButton = wrapper.find('button');
    expect(applyButton.attributes('disabled')).toBeDefined();
  });

  it('applies the tag with the selected fields and emits tagged on success', async () => {
    const wrapper = mountComponent();

    const selects = wrapper.findAll('select');
    const ceSelect = selects[0];
    const areaSelect = selects[1];
    const basisSelect = selects[3];

    await ceSelect.setValue('CE-7');
    await areaSelect.setValue('AGA');
    await basisSelect.setValue('Oversight Record');

    const pqSelect = selects.find((s) => s.attributes('multiple') !== undefined);
    await pqSelect.setValue(['PQ 8.315']);

    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockStore.applyDirectTag).toHaveBeenCalledWith({
      tag: {
        nodeId: 'node-1',
        criticalElement: 'CE-7',
        areaCode: 'AGA',
        ceMapping: ['CE-7'],
        areaMapping: ['AGA'],
        pqReferences: ['PQ 8.315'],
        evidenceBasis: 'Oversight Record',
      },
      csrfToken: 'csrf-token',
    });
    expect(wrapper.emitted('tagged')).toBeTruthy();
    expect(wrapper.emitted('tagged')[0][0]).toEqual({ success: true, usoapTagSource: 'Direct' });
  });
});
