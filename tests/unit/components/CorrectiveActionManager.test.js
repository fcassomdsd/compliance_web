import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CorrectiveActionManager from '@/views/CorrectiveActionManager.vue';
import { useCapStore } from '@/stores/capStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('../../../src/stores/capStore');
vi.mock('../../../src/stores/authStore');
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
}));

describe('CorrectiveActionManager.vue', () => {
  let mockCapStore;
  let mockAuthStore;

  const mountComponent = () => mount(CorrectiveActionManager, {
    global: {
      stubs: {
        BaseManager: { template: '<div><slot /></div>' },
        ScopePicker: {
          template: '<div><button type="button" class="scope-search" @click="$emit(\'search\')">Search</button><button type="button" class="scope-reset" @click="$emit(\'reset\')">Reset</button></div>',
        },
      },
    },
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    const { useRoute } = await import('vue-router');
    vi.mocked(useRoute).mockReturnValue({ query: { findingId: 'FIND-123' } });

    mockCapStore = {
      caps: [{ capId: 'CAP-1', acceptanceStatus: 'Pending review', responsibleEntity: 'Org A', dueDate: '2026-05-01' }],
      drafts: [],
      selectedCap: null,
      loading: false,
      error: null,
      setFilter: vi.fn(),
      fetchCaps: vi.fn().mockResolvedValue(undefined),
      fetchDrafts: vi.fn().mockResolvedValue(undefined),
      submitCap: vi.fn().mockResolvedValue({ cap: { capId: 'CAP-10' } }),
      updateCap: vi.fn().mockResolvedValue({ cap: { capId: 'CAP-1', acceptanceStatus: 'Not Accepted' } }),
      saveDraft: vi.fn().mockResolvedValue({ draftId: 'DRAFT-1' }),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
      submitDraft: vi.fn().mockResolvedValue({ cap: { capId: 'CAP-20' } }),
      reviewCap: vi.fn().mockResolvedValue({ ok: true }),
      fetchCapDetail: vi.fn().mockResolvedValue(undefined),
      updateActionItem: vi.fn().mockResolvedValue(undefined),
      uploadCapEvidence: vi.fn().mockResolvedValue(undefined),
      deleteCapEvidence: vi.fn().mockResolvedValue(undefined),
      clearSelectedCap: vi.fn(),
    };
    mockAuthStore = { csrfToken: 'csrf-token' };

    vi.mocked(useCapStore).mockReturnValue(mockCapStore);
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
  });

  it('loads caps and drafts on mount and pre-fills finding id from query', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
    expect(mockCapStore.fetchDrafts).toHaveBeenCalled();
    expect(wrapper.vm.capForm.findingId).toBe('FIND-123');
    expect(wrapper.vm.editMode.type).toBe('new');
  });

  it('loadCaps applies filters before fetching', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.scope.preset = 'accepted-caps';
    wrapper.vm.scope.acceptanceStatus = 'Not Accepted';
    wrapper.vm.scope.locationId = 'LOC-1';
    wrapper.vm.scope.providerId = 'PROV-1';
    wrapper.vm.scope.inspectionId = 'INS-1';
    wrapper.vm.scope.domain = 'AGA';

    await wrapper.vm.loadCaps();

    expect(mockCapStore.setFilter).toHaveBeenCalledWith('acceptanceStatus', 'Accepted');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('locationId', 'LOC-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('providerId', 'PROV-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('inspectionId', 'INS-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('domain', 'AGA');
    expect(mockCapStore.fetchCaps).toHaveBeenCalledTimes(2);
  });

  it('submitForReviewAction (new CAP) sends payload, shows success message, resets form and refreshes', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    wrapper.vm.capForm.dueDate = '2026-12-31';
    wrapper.vm.rcaEvidenceFiles = [new File(['x'], 'evidence.pdf')];

    await wrapper.vm.submitForReviewAction();

    expect(mockCapStore.submitCap).toHaveBeenCalledWith({
      findingId: 'F-1',
      payload: {
        dueDate: '2026-12-31',
        rootCauseAnalysis: {
          method: '5 Whys',
          otherMethodDescription: '',
          mainCategory: '',
          rootCause: '',
          contributingFactors: '',
        },
        riskAssessment: {
          hazard: '',
          consequence: '',
          probability: '',
          severity: '',
          calculatedRiskLevel: '',
          tolerabilityLevel: '',
          justification: '',
        },
        containmentMeasures: {
          description: '',
          implementedDate: '',
        },
        correctiveActions: [
          { description: '', priority: 'Medium', responsiblePerson: '', deadline: '' },
        ],
        residualRisk: {
          probability: '',
          severity: '',
          riskLevel: '',
          justification: '',
        },
        effectivenessVerification: {
          method: '',
          indicators: '',
          projectedVerificationDate: '',
        },
      },
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.message).toContain('submitted successfully');
    expect(wrapper.vm.editMode.type).toBe('new');
    expect(mockCapStore.fetchCaps).toHaveBeenCalledTimes(2);
  });

  it('saveDraftAction creates a new draft and switches editMode to draft', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    await wrapper.vm.saveDraftAction();

    expect(mockCapStore.saveDraft).toHaveBeenCalledWith({
      draftId: null,
      findingId: 'F-1',
      payload: expect.any(Object),
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.editMode).toEqual({ type: 'draft', draftId: 'DRAFT-1' });
    expect(wrapper.vm.message).toContain('Draft saved');
  });

  it('saveDraftAction updates an existing draft in place', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editMode = { type: 'draft', draftId: 'DRAFT-9' };
    await wrapper.vm.saveDraftAction();

    expect(mockCapStore.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ draftId: 'DRAFT-9' }));
  });

  it('submitForReviewAction (draft mode) saves then promotes the draft', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editMode = { type: 'draft', draftId: 'DRAFT-9' };
    wrapper.vm.riskEvidenceFiles = [new File(['x'], 'evidence.pdf')];
    await wrapper.vm.submitForReviewAction();

    expect(mockCapStore.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ draftId: 'DRAFT-9' }));
    expect(mockCapStore.submitDraft).toHaveBeenCalledWith('DRAFT-9', 'csrf-token');
    expect(wrapper.vm.editMode.type).toBe('new');
    expect(mockCapStore.fetchDrafts).toHaveBeenCalledTimes(2);
  });

  it('editDraft populates the form from a draft payload and enters draft edit mode', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editDraft({
      draftId: 'DRAFT-5',
      findingId: 'F-9',
      payload: {
        dueDate: '2026-08-01',
        rootCauseAnalysis: { method: 'Fishbone' },
      },
    });

    expect(wrapper.vm.editMode).toEqual({ type: 'draft', draftId: 'DRAFT-5' });
    expect(wrapper.vm.capForm.findingId).toBe('F-9');
    expect(wrapper.vm.capForm.dueDate).toBe('2026-08-01');
    expect(wrapper.vm.capForm.rootCauseAnalysis.method).toBe('Fishbone');
    expect(wrapper.vm.showSubmit).toBe(true);
  });

  it('deleteDraftAction removes the draft and resets the form if it was being edited', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editMode = { type: 'draft', draftId: 'DRAFT-5' };
    await wrapper.vm.deleteDraftAction('DRAFT-5');

    expect(mockCapStore.deleteDraft).toHaveBeenCalledWith('DRAFT-5', 'csrf-token');
    expect(wrapper.vm.editMode.type).toBe('new');
  });

  it('editCap fetches CAP detail and populates the form for a Not Accepted CAP', async () => {
    mockCapStore.fetchCapDetail = vi.fn().mockImplementation(async () => {
      mockCapStore.selectedCap = {
        capId: 'CAP-7',
        findingId: 'F-7',
        dueDate: '2026-09-01',
        acceptanceStatus: 'Not Accepted',
        rootCauseAnalysis: { method: 'BowTie' },
        correctiveActions: [{ sequenceNumber: 1, description: 'Existing', responsiblePerson: 'A', deadline: '2026-09-15' }],
      };
    });

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.editCap({ capId: 'CAP-7' });

    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-7');
    expect(wrapper.vm.editMode).toEqual({ type: 'notAccepted', capId: 'CAP-7' });
    expect(wrapper.vm.capForm.findingId).toBe('F-7');
    expect(wrapper.vm.capForm.rootCauseAnalysis.method).toBe('BowTie');
    expect(wrapper.vm.capForm.correctiveActions).toHaveLength(1);
    expect(wrapper.vm.showSubmit).toBe(true);
  });

  it('saveReturnedChangesAction saves without resubmitting', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editMode = { type: 'notAccepted', capId: 'CAP-7' };
    await wrapper.vm.saveReturnedChangesAction();

    expect(mockCapStore.updateCap).toHaveBeenCalledWith({
      capId: 'CAP-7',
      payload: expect.not.objectContaining({ resubmit: true }),
      csrfToken: 'csrf-token',
    });
    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-7');
    expect(wrapper.vm.editMode.type).toBe('notAccepted');
  });

  it('resubmitReturnedAction saves with resubmit flag and resets the form', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.editMode = { type: 'notAccepted', capId: 'CAP-7' };
    await wrapper.vm.resubmitReturnedAction();

    expect(mockCapStore.updateCap).toHaveBeenCalledWith({
      capId: 'CAP-7',
      payload: expect.objectContaining({ resubmit: true }),
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.editMode.type).toBe('new');
  });

  it('isCapEditableStatus is true only for Not Accepted', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isCapEditableStatus('Not Accepted')).toBe(true);
    expect(wrapper.vm.isCapEditableStatus('Pending review')).toBe(false);
    expect(wrapper.vm.isCapEditableStatus('Accepted')).toBe(false);
  });

  it('isCapReviewable is true only for Pending review', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isCapReviewable('Pending review')).toBe(true);
    expect(wrapper.vm.isCapReviewable('Accepted')).toBe(false);
    expect(wrapper.vm.isCapReviewable('Not Accepted')).toBe(false);
  });

  it('startReview enters review mode, fetches detail, and resets prior decision/reason', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-20', acceptanceStatus: 'Pending review' };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.startReview('CAP-20');

    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-20');
    expect(wrapper.vm.reviewMode).toBe(true);
    expect(wrapper.vm.reviewDecision).toBe('Accepted');
    expect(wrapper.vm.reviewReason).toBe('');
  });

  it('cancelReview exits review mode without submitting', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.startReview('CAP-20');
    wrapper.vm.cancelReview();

    expect(wrapper.vm.reviewMode).toBe(false);
    expect(mockCapStore.reviewCap).not.toHaveBeenCalled();
  });

  it('confirmReview rejects a Not Accepted decision with no reason, without calling the store', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-20', acceptanceStatus: 'Pending review' };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.startReview('CAP-20');
    wrapper.vm.reviewDecision = 'Not Accepted';
    await wrapper.vm.confirmReview();

    expect(mockCapStore.reviewCap).not.toHaveBeenCalled();
    expect(wrapper.vm.reviewValidationError).toContain('reason is required');
  });

  it('confirmReview sends the decision and reason, then exits review mode and refreshes', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-20', acceptanceStatus: 'Pending review' };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.startReview('CAP-20');
    wrapper.vm.reviewDecision = 'Not Accepted';
    wrapper.vm.reviewReason = 'Root cause does not explain the finding';
    await wrapper.vm.confirmReview();

    expect(mockCapStore.reviewCap).toHaveBeenCalledWith({
      capId: 'CAP-20',
      acceptanceStatus: 'Not Accepted',
      reason: 'Root cause does not explain the finding',
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.reviewMode).toBe(false);
    expect(wrapper.vm.message).toContain('review applied');
  });

  it('reviewChecklist flags missing sections and evidence', async () => {
    mockCapStore.selectedCap = {
      capId: 'CAP-20',
      acceptanceStatus: 'Pending review',
      rootCauseAnalysis: { method: 'Fishbone', rootCause: '', evidence: [] },
      correctiveActions: [],
    };
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const rcaCheck = wrapper.vm.reviewChecklist.find((c) => c.label === 'Root Cause Analysis complete');
    const actionsCheck = wrapper.vm.reviewChecklist.find((c) => c.label === 'At least one Corrective Action defined');
    const evidenceCheck = wrapper.vm.reviewChecklist.find((c) => c.label === 'At least one evidence file attached');

    expect(rcaCheck.met).toBe(false);
    expect(actionsCheck.met).toBe(false);
    expect(evidenceCheck.met).toBe(false);
  });

  it('viewCap fetches selected CAP detail', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.viewCap('CAP-1');
    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-1');
  });

  it('keeps running and logs on submit/review/followup failures', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCapStore.submitCap.mockRejectedValueOnce(new Error('submit error'));
    mockCapStore.reviewCap.mockRejectedValueOnce(new Error('review error'));
    mockCapStore.selectedCap = { capId: 'CAP-20', acceptanceStatus: 'Pending review' };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.rcaEvidenceFiles = [new File(['x'], 'evidence.pdf')];
    await wrapper.vm.submitForReviewAction();
    await wrapper.vm.startReview('CAP-20');
    await wrapper.vm.confirmReview();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('shows a confirmation modal instead of submitting when no evidence is attached', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    await wrapper.vm.submitForReviewAction();

    expect(wrapper.vm.showNoEvidenceConfirm).toBe(true);
    expect(mockCapStore.submitCap).not.toHaveBeenCalled();
  });

  it('confirmSubmitWithoutEvidence closes the modal and proceeds with submission', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    await wrapper.vm.submitForReviewAction();
    await wrapper.vm.confirmSubmitWithoutEvidence();

    expect(wrapper.vm.showNoEvidenceConfirm).toBe(false);
    expect(mockCapStore.submitCap).toHaveBeenCalled();
  });

  it('cancelSubmitWithoutEvidence closes the modal without submitting', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    await wrapper.vm.submitForReviewAction();
    wrapper.vm.cancelSubmitWithoutEvidence();

    expect(wrapper.vm.showNoEvidenceConfirm).toBe(false);
    expect(mockCapStore.submitCap).not.toHaveBeenCalled();
  });

  it('uploads every selected evidence file right after a successful submit', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const rcaFile1 = new File(['x'], 'evidence-1.pdf');
    const rcaFile2 = new File(['z'], 'evidence-2.pdf');
    const riskFile = new File(['y'], 'risk.pdf');
    wrapper.vm.capForm.findingId = 'F-1';
    wrapper.vm.rcaEvidenceFiles = [rcaFile1, rcaFile2];
    wrapper.vm.riskEvidenceFiles = [riskFile];
    await wrapper.vm.submitForReviewAction();

    expect(mockCapStore.uploadCapEvidence).toHaveBeenCalledWith({
      capId: 'CAP-10',
      section: 'rca',
      file: rcaFile1,
      csrfToken: 'csrf-token',
    });
    expect(mockCapStore.uploadCapEvidence).toHaveBeenCalledWith({
      capId: 'CAP-10',
      section: 'rca',
      file: rcaFile2,
      csrfToken: 'csrf-token',
    });
    expect(mockCapStore.uploadCapEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ capId: 'CAP-10', section: 'risk-assessment' })
    );
  });

  it('selecting another file appends to the staged list instead of replacing it', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const firstFile = new File(['x'], 'first.pdf');
    const secondFile = new File(['y'], 'second.pdf');

    wrapper.vm.onEvidenceFileChange({ target: { files: [firstFile], value: '' } }, 'rca');
    wrapper.vm.onEvidenceFileChange({ target: { files: [secondFile], value: '' } }, 'rca');

    expect(wrapper.vm.rcaEvidenceFiles).toEqual([firstFile, secondFile]);
  });

  it('removeStagedEvidence removes a single file without touching the others', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const firstFile = new File(['x'], 'first.pdf');
    const secondFile = new File(['y'], 'second.pdf');
    wrapper.vm.rcaEvidenceFiles = [firstFile, secondFile];

    wrapper.vm.removeStagedEvidence('rca', 0);

    expect(wrapper.vm.rcaEvidenceFiles).toEqual([secondFile]);
  });

  it('saveDraftAction warns that selected evidence is not saved with the draft', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    wrapper.vm.rcaEvidenceFiles = [new File(['x'], 'evidence.pdf')];
    await wrapper.vm.saveDraftAction();

    expect(wrapper.vm.message).toContain('not saved with drafts');
  });

  it('hides the create-time evidence inputs while editing a Not Accepted CAP', async () => {
    mockCapStore.fetchCapDetail = vi.fn().mockImplementation(async () => {
      mockCapStore.selectedCap = { capId: 'CAP-7', findingId: 'F-7', acceptanceStatus: 'Not Accepted' };
    });

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();
    await wrapper.vm.editCap({ capId: 'CAP-7' });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#rcaEvidence').exists()).toBe(false);
    expect(wrapper.find('#raEvidence').exists()).toBe(false);
    expect(wrapper.text()).toContain('Evidence can be attached from the CAP Detail view below.');
  });

  it('wires template actions through buttons (search and view)', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll('button');
    const searchBtn = buttons.find((btn) => btn.text() === 'Search');
    const viewBtn = buttons.find((btn) => btn.text() === 'View');

    await searchBtn.trigger('click');
    await viewBtn.trigger('click');

    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-1');
  });

  it('shows an Edit button in the listing only for Not Accepted CAPs', async () => {
    mockCapStore.caps = [
      { capId: 'CAP-1', acceptanceStatus: 'Pending review', responsibleEntity: 'Org A', dueDate: '2026-05-01' },
      { capId: 'CAP-2', acceptanceStatus: 'Not Accepted', responsibleEntity: 'Org B', dueDate: '2026-06-01' },
    ];

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const rows = wrapper.findAll('tbody tr');
    const editButtonsInFirstRow = rows[0].findAll('button').filter((btn) => btn.text() === 'Edit');
    const editButtonsInSecondRow = rows[1].findAll('button').filter((btn) => btn.text() === 'Edit');

    expect(editButtonsInFirstRow).toHaveLength(0);
    expect(editButtonsInSecondRow).toHaveLength(1);
  });

  it('shows a Review button in the listing only for Pending review CAPs', async () => {
    mockCapStore.caps = [
      { capId: 'CAP-1', acceptanceStatus: 'Pending review', responsibleEntity: 'Org A', dueDate: '2026-05-01' },
      { capId: 'CAP-2', acceptanceStatus: 'Accepted', responsibleEntity: 'Org B', dueDate: '2026-06-01' },
    ];

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const rows = wrapper.findAll('tbody tr');
    const reviewButtonsInFirstRow = rows[0].findAll('button').filter((btn) => btn.text() === 'Review');
    const reviewButtonsInSecondRow = rows[1].findAll('button').filter((btn) => btn.text() === 'Review');

    expect(reviewButtonsInFirstRow).toHaveLength(1);
    expect(reviewButtonsInSecondRow).toHaveLength(0);
  });

  it('clicking Review in the listing row starts review mode for that CAP', async () => {
    mockCapStore.caps = [
      { capId: 'CAP-1', acceptanceStatus: 'Pending review', responsibleEntity: 'Org A', dueDate: '2026-05-01' },
    ];

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const reviewButton = wrapper.findAll('tbody tr')[0].findAll('button').find((btn) => btn.text() === 'Review');
    await reviewButton.trigger('click');

    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-1');
    expect(wrapper.vm.reviewMode).toBe(true);
  });

  it('renders the My Draft CAPs section when drafts exist', async () => {
    mockCapStore.drafts = [
      { draftId: 'DRAFT-1', findingId: 'F-1', updatedAt: '2026-06-01' },
    ];

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('My Draft CAPs');
    expect(wrapper.text()).toContain('F-1');
  });

  it('shows attached evidence with View only (no Remove/upload) for a non-editable CAP', async () => {
    mockCapStore.selectedCap = {
      capId: 'CAP-90',
      acceptanceStatus: 'Accepted',
      rootCauseAnalysis: { method: 'Fishbone', evidence: [{ nodeId: 'ev-1', name: 'photo.jpg' }] },
      riskAssessment: { identifiedHazard: 'x', evidence: [] },
    };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('photo.jpg');
    const listItem = wrapper.findAll('li').find((li) => li.text().includes('photo.jpg'));
    const buttonLabels = listItem.findAll('button').map((btn) => btn.text());
    expect(buttonLabels).toContain('View');
    expect(buttonLabels).not.toContain('Remove');
    expect(wrapper.find('.evidence-upload').exists()).toBe(false);
  });

  it('shows Remove and the upload control for a Not Accepted CAP', async () => {
    mockCapStore.selectedCap = {
      capId: 'CAP-91',
      acceptanceStatus: 'Not Accepted',
      rootCauseAnalysis: { method: 'Fishbone', evidence: [{ nodeId: 'ev-2', name: 'notes.pdf' }] },
    };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const listItem = wrapper.findAll('li').find((li) => li.text().includes('notes.pdf'));
    const buttonLabels = listItem.findAll('button').map((btn) => btn.text());
    expect(buttonLabels).toContain('View');
    expect(buttonLabels).toContain('Remove');
    expect(wrapper.find('.evidence-upload').exists()).toBe(true);
  });

  it('viewEvidence opens the evidence content URL in a new tab', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-90', acceptanceStatus: 'Accepted' };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.viewEvidence({ nodeId: 'ev-1', name: 'photo.jpg' });

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/caps/CAP-90/evidence/ev-1/content'), '_blank', 'noopener');
    openSpy.mockRestore();
  });

  it('removing evidence requires confirmation before calling the store', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-91', acceptanceStatus: 'Not Accepted' };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.confirmRemoveEvidence({ nodeId: 'ev-2', name: 'notes.pdf' });
    expect(wrapper.vm.evidenceToRemove).toEqual({ nodeId: 'ev-2', name: 'notes.pdf' });
    expect(mockCapStore.deleteCapEvidence).not.toHaveBeenCalled();

    wrapper.vm.cancelRemoveEvidence();
    expect(wrapper.vm.evidenceToRemove).toBe(null);
    expect(mockCapStore.deleteCapEvidence).not.toHaveBeenCalled();

    wrapper.vm.confirmRemoveEvidence({ nodeId: 'ev-2', name: 'notes.pdf' });
    await wrapper.vm.removeEvidenceConfirmed();

    expect(mockCapStore.deleteCapEvidence).toHaveBeenCalledWith({
      capId: 'CAP-91',
      evidenceNodeId: 'ev-2',
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.evidenceToRemove).toBe(null);
    expect(wrapper.vm.message).toContain('Evidence removed');
  });

  it('closeCapDetail clears the selected CAP so the detail card can be dismissed', async () => {
    mockCapStore.selectedCap = { capId: 'CAP-90', acceptanceStatus: 'Accepted' };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const closeButton = wrapper.findAll('button').find((btn) => btn.text() === 'Close');
    expect(closeButton).toBeDefined();

    await closeButton.trigger('click');

    expect(mockCapStore.clearSelectedCap).toHaveBeenCalled();
  });

  it('renders cap detail and error message regions when store state is set', async () => {
    mockCapStore.selectedCap = {
      capId: 'CAP-90',
      proposedAction: 'Action',
      responsibleEntity: 'Org Z',
      acceptanceStatus: 'Accepted',
      dueDate: '2026-10-01',
      followUpReports: [{ id: 'FU-1' }],
    };
    mockCapStore.error = 'CAP error';

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('CAP Detail: CAP-90');
    expect(wrapper.text()).toContain('CAP error');
  });

  it('handles missing findingId in route query on mount', async () => {
    const { useRoute } = await import('vue-router');
    vi.mocked(useRoute).mockReturnValueOnce({ query: {} });

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.capForm.findingId).toBe('');
    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
  });
});
