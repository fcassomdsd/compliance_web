import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScopePicker from '@/components/common/ScopePicker.vue';

describe('ScopePicker.vue', () => {
  it('syncs scope input and emits search/reset events', async () => {
    const wrapper = mount(ScopePicker, {
      props: {
        modelValue: {
          preset: '',
          findingId: '',
          providerId: '',
          locationId: '',
          specialtyCode: '',
          inspectionId: '',
          domain: '',
          findingStatus: '',
          capOverdueOnly: false,
          solutionOverdueOnly: false,
          followUpType: '',
        },
        presets: [{ value: 'open-findings', label: 'Open findings' }],
        showFollowUpType: true,
      },
    });

    await wrapper.find('#scopeFindingId').setValue('F-1');
    await wrapper.find('#scopeProviderId').setValue('PROV-1');
    await wrapper.find('#scopeFollowUpType').setValue('CAP Verification');

    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted()['update:modelValue']).toBeTruthy();
    expect(wrapper.emitted().search).toHaveLength(1);
    expect(wrapper.emitted().search[0][0]).toMatchObject({
      findingId: 'F-1',
      providerId: 'PROV-1',
      followUpType: 'CAP Verification',
    });

    await wrapper.find('button[type="button"]').trigger('click');
    expect(wrapper.emitted().reset).toHaveLength(1);
  });
});