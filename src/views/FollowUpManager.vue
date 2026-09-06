<template>
  <BaseManager :title="t('app.nav.followUps')">
    <section class="card">
      <h3>{{ t('followUpManager.listing') }}</h3>
      <ScopePicker
        v-model="scope"
        mode="follow-ups"
        :title="t('followUpManager.scope')"
        :loading="followUpStore.loading"
        :show-provider-id="true"
        :show-status="true"
        :show-cap-overdue-only="false"
        :show-solution-overdue-only="false"
        :show-domain="true"
        :show-inspection-id="true"
        :presets="[]"
        :show-follow-up-type="true"
        @search="loadFollowUps"
        @reset="loadFollowUps"
      />

      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('followUpManager.followUpId') }}</th>
            <th>{{ t('findingManager.findingId') }}</th>
            <th>{{ t('common.type') }}</th>
            <th>{{ t('followUpManager.locationCode') }}</th>
            <th>{{ t('assignInspectors.specialty') }}</th>
            <th>{{ t('followUpManager.percentComplete') }}</th>
            <th>{{ t('followUpManager.inheritedCap') }}</th>
            <th>{{ t('followUpManager.evidenceReview') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="followUp in followUpStore.followUps" :key="followUp.followUpId">
            <td>{{ followUp.followUpId }}</td>
            <td>{{ followUp.findingId || '-' }}</td>
            <td>{{ followUp.followUpType || '-' }}</td>
            <td>{{ followUp.locationCode || followUp.locationId || '-' }}</td>
            <td>{{ followUp.specialtyCode || '-' }}</td>
            <td>{{ followUp.percentComplete ?? '-' }}</td>
            <td>{{ followUp.inheritedCapId || '-' }}</td>
            <td>{{ followUp.evidenceReviewStatus || '-' }}</td>
            <td><BaseButton variant="ghost" size="sm" @click="viewFollowUp(followUp)">{{ t('common.view') }}</BaseButton></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="selectedFollowUp" class="card detail-panel">
      <h3>{{ t('followUpManager.detail') }}: {{ selectedFollowUp.followUpId }}</h3>
      <BaseButton variant="ghost" size="sm" @click="closeFollowUpDetail">{{ t('common.close') }}</BaseButton>
      <p><strong>{{ t('findingManager.findingId') }}:</strong> {{ selectedFollowUp.findingId || '-' }}</p>
      <p><strong>{{ t('common.type') }}:</strong> {{ selectedFollowUp.followUpType || '-' }}</p>
      <p><strong>{{ t('followUpManager.followUpDate') }}:</strong> {{ selectedFollowUp.followUpDate || '-' }}</p>
      <p><strong>{{ t('followUpManager.percentComplete') }}:</strong> {{ selectedFollowUp.percentComplete ?? '-' }}</p>
      <p><strong>{{ t('followUpManager.inheritedCap') }}:</strong> {{ selectedFollowUp.inheritedCapId || '-' }}</p>
      <p><strong>{{ t('followUpManager.findingClosed') }}:</strong> {{ selectedFollowUp.findingClosed ? t('common.yes') : t('common.no') }}</p>
      <p><strong>{{ t('followUpManager.effectivenessConfirmed') }}:</strong> {{ selectedFollowUp.effectivenessConfirmed ? t('common.yes') : t('common.no') }}</p>
      <p><strong>{{ t('followUpManager.evidenceReviewStatus') }}:</strong> {{ selectedFollowUp.evidenceReviewStatus || '-' }}</p>
      <template v-if="selectedFollowUp.evidenceReviewedBy">
        <p><strong>{{ t('followUpManager.reviewedBy') }}:</strong> {{ selectedFollowUp.evidenceReviewedBy }} {{ t('followUpManager.on') }} {{ selectedFollowUp.evidenceReviewDate || '-' }}</p>
        <p v-if="selectedFollowUp.evidenceReviewNotes"><strong>{{ t('followUpManager.reviewNotes') }}:</strong> {{ selectedFollowUp.evidenceReviewNotes }}</p>
      </template>

      <div v-if="selectedFollowUp.evidence?.length" class="evidence-list">
        <p class="evidence-list-title"><strong>{{ t('followUpManager.attachments') }}</strong></p>
        <ul>
          <li v-for="item in selectedFollowUp.evidence" :key="item.nodeId">
            <span class="evidence-name">{{ item.name }}</span>
            <span class="evidence-meta">{{ item.evidenceRole || '-' }} &middot; {{ item.collectionMethod || '-' }}</span>
            <BaseButton variant="ghost" size="sm" @click="viewFollowUpEvidence(item)">{{ t('common.view') }}</BaseButton>
          </li>
        </ul>
      </div>
      <p v-else class="evidence-list-empty">{{ t('findingManager.noEvidence') }}</p>

      <div v-if="selectedFollowUp.evidenceReviewStatus === 'Pending Review'" class="evidence-review-panel">
        <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showEvidenceReviewForm }" @click="showEvidenceReviewForm = !showEvidenceReviewForm">{{ t('followUpManager.reviewEvidence') }}</BaseButton>
        <div v-if="showEvidenceReviewForm" class="form-grid">
          <div class="form-field">
            <label for="evidenceReviewDecision">{{ t('findingManager.decision') }}</label>
            <select id="evidenceReviewDecision" v-model="evidenceReviewForm.decision">
              <option value="Adequate">{{ t('followUpManager.adequate') }}</option>
              <option value="Inadequate">{{ t('followUpManager.inadequate') }}</option>
            </select>
          </div>
          <div class="form-field field-span-2">
            <label for="evidenceReviewNotes">{{ t('followUpManager.notes') }}</label>
            <textarea id="evidenceReviewNotes" v-model="evidenceReviewForm.notes" rows="2" />
          </div>
          <div class="form-actions">
            <BaseButton variant="primary" @click="reviewEvidence" :disabled="followUpStore.loading">{{ t('findingManager.applyDecision') }}</BaseButton>
          </div>
        </div>
      </div>

      <UsoapDirectTagPanel v-if="selectedFollowUp.nodeId" :node-id="selectedFollowUp.nodeId" />
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showForm }" @click="showForm = !showForm">{{ t('followUpManager.registerFollowUp') }}</BaseButton>
    </div>

    <section v-if="showForm" class="card">
      <h3>{{ t('followUpManager.registerFollowUp') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="followFindingId">{{ t('findingManager.findingId') }}</label>
          <input id="followFindingId" v-model="form.findingId" type="text" />
        </div>

        <div class="form-field">
          <label for="followType">{{ t('followUpManager.followUpType') }}</label>
          <select id="followType" v-model="form.followUpType">
            <option v-for="type in followUpTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>

        <div class="form-field">
          <label for="followInheritedCapId">{{ t('followUpManager.inheritedCapIdOptional') }}</label>
          <input id="followInheritedCapId" v-model="form.inheritedCapId" type="text" />
        </div>

        <div class="form-field">
          <label for="followDate">{{ t('followUpManager.followUpDate') }}</label>
          <input id="followDate" v-model="form.followUpDate" type="datetime-local" />
        </div>

        <div class="form-field">
          <label for="followPercent">{{ t('followUpManager.percentComplete') }}</label>
          <input id="followPercent" v-model.number="form.percentComplete" type="number" min="0" max="100" />
        </div>

        <div class="form-field">
          <label for="followClosed">{{ t('followUpManager.findingClosed') }}</label>
          <input id="followClosed" v-model="form.findingClosed" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="followEffective">{{ t('followUpManager.effectivenessConfirmed') }}</label>
          <input id="followEffective" v-model="form.effectivenessConfirmed" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="followClosureDate">{{ t('followUpManager.closureDate') }}</label>
          <input id="followClosureDate" v-model="form.followUpClosureDate" type="date" />
        </div>

        <div class="form-field">
          <label for="followMethod">{{ t('followUpManager.verificationMethod') }}</label>
          <input id="followMethod" v-model="form.closureVerificationMethod" type="text" />
        </div>

        <div class="form-field">
          <label for="followEvidenceRole">{{ t('followUpManager.evidenceRole') }}</label>
          <select id="followEvidenceRole" v-model="form.evidenceRole">
            <option v-for="role in followUpEvidenceRoles" :key="role" :value="role">{{ role }}</option>
          </select>
        </div>

        <div class="form-field">
          <label for="followEvidenceCollectionMethod">{{ t('followUpManager.evidenceCollectionMethod') }}</label>
          <select id="followEvidenceCollectionMethod" v-model="form.collectionMethod">
            <option v-for="collectionMethod in followUpEvidenceCollectionMethods" :key="collectionMethod" :value="collectionMethod">{{ collectionMethod }}</option>
          </select>
        </div>

        <div class="form-field field-span-2">
          <label for="followEvidenceFiles">{{ t('followUpManager.attachEvidenceOptional') }}</label>
          <input id="followEvidenceFiles" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange" />
          <div v-if="stagedEvidenceFiles.length" class="evidence-list">
            <ul>
              <li v-for="(file, index) in stagedEvidenceFiles" :key="`${file.name}-${index}`">
                <span class="evidence-name">{{ file.name }}</span>
                <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence(index)">{{ t('followUpManager.remove') }}</BaseButton>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <BaseButton variant="primary" @click="createFollowUp" :disabled="followUpStore.loading">{{ t('followUpManager.createFollowUp') }}</BaseButton>
      </div>
    </section>

    <p v-if="searchErrorMessage" class="error-message">{{ searchErrorMessage }}</p>
    <p v-else-if="followUpStore.error" class="error-message">{{ followUpStore.error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import UsoapDirectTagPanel from '@/components/UsoapDirectTagPanel.vue';
import { useFollowUpStore } from '@/stores/followUpStore';
import { useAuthStore } from '@/stores/authStore';
import { apiFollowUpEvidenceContentUrl } from '@/services/apiServices';
import { EVIDENCE_FILE_ACCEPT, validateEvidenceFile } from '@/utils/evidenceFile';

const { t } = useI18n();
const route = useRoute();
const followUpStore = useFollowUpStore();
const authStore = useAuthStore();

const message = ref('');
const searchErrorMessage = ref('');
const showForm = ref(false);
const showEvidenceReviewForm = ref(false);
const selectedFollowUp = ref(null);
const stagedEvidenceFiles = ref([]);

const evidenceReviewForm = reactive({
  findingId: '',
  followUpId: '',
  decision: 'Adequate',
  notes: '',
});

const followUpTypes = [
  'Progress Review',
  'CAP Verification',
  'Closure Verification',
  'Ad-hoc Inquiry',
];

// Field app / follow-up evidence roles only — reuses the same
// vso:evidenceRoleList values the CAP evidence flow uses elsewhere.
const followUpEvidenceRoles = ['Progress Evidence', 'Closure Evidence'];
// 'On-site' is reserved for the field app's ZIP import path — evidence
// attached directly through this form always entered the app already
// vetted (remote or provider-submitted), per the BPMN evidence flow.
const followUpEvidenceCollectionMethods = ['Remote', 'Provider-submitted'];

const form = reactive({
  findingId: '',
  followUpType: 'Progress Review',
  inheritedCapId: '',
  followUpDate: '',
  percentComplete: 0,
  findingClosed: false,
  effectivenessConfirmed: false,
  followUpClosureDate: '',
  closureVerificationMethod: '',
  evidenceRole: 'Progress Evidence',
  collectionMethod: 'Remote',
});

watch(() => form.followUpType, (followUpType) => {
  form.evidenceRole = followUpType === 'Closure Verification' ? 'Closure Evidence' : 'Progress Evidence';
});

let scope = reactive({
  findingId: '',
  providerId: '',
  locationId: '',
  specialtyCode: '',
  inspectionId: '',
  domain: '',
  findingStatus: '',
  followUpType: '',
});

async function loadFollowUps() {
  searchErrorMessage.value = '';
  followUpStore.setFilter('findingId', scope.findingId);
  followUpStore.setFilter('providerId', scope.providerId);
  followUpStore.setFilter('locationId', scope.locationId);
  followUpStore.setFilter('specialtyCode', scope.specialtyCode);
  followUpStore.setFilter('inspectionId', scope.inspectionId);
  followUpStore.setFilter('domain', scope.domain);
  followUpStore.setFilter('status', scope.findingStatus);
  followUpStore.setFilter('statusMode', 'effective');
  followUpStore.setFilter('capOverdueOnly', false);
  followUpStore.setFilter('solutionOverdueOnly', false);
  followUpStore.setFilter('skipCount', 0);
  followUpStore.setFilter('maxItems', 50);
  followUpStore.setFilter('followUpType', scope.followUpType);
  try {
    await followUpStore.fetchFollowUps();
  } catch (error) {
    // Store keeps the canonical error string used by the view.
    console.error('Follow-up search failed:', error);
    searchErrorMessage.value = t('followUpManager.toast.loadError');
  }
}

function onEvidenceFileChange(event) {
  searchErrorMessage.value = '';
  const selectedFiles = Array.from(event.target.files || []);
  const accepted = [];
  const rejectedMessages = [];
  for (const file of selectedFiles) {
    const validationError = validateEvidenceFile(file);
    if (validationError) {
      rejectedMessages.push(validationError);
    } else {
      accepted.push(file);
    }
  }
  if (rejectedMessages.length) {
    searchErrorMessage.value = rejectedMessages.join(' ');
  }
  stagedEvidenceFiles.value = [...stagedEvidenceFiles.value, ...accepted];
  // Clear the input so choosing the same file again still fires 'change'
  // (each selection is appended to the staged list above, not replaced).
  event.target.value = '';
}

function removeStagedEvidence(index) {
  stagedEvidenceFiles.value = stagedEvidenceFiles.value.filter((_, i) => i !== index);
}

async function uploadStagedEvidence({ findingId, followUpId }) {
  for (const file of stagedEvidenceFiles.value) {
    await followUpStore.uploadFollowUpEvidence({
      findingId,
      followUpId,
      file,
      evidenceRole: form.evidenceRole,
      collectionMethod: form.collectionMethod,
      csrfToken: authStore.csrfToken,
    });
  }
}

async function createFollowUp() {
  message.value = '';
  searchErrorMessage.value = '';
  try {
    const created = await followUpStore.createFollowUp({
      findingId: form.findingId,
      payload: {
        followUpType: form.followUpType,
        inheritedCapId: form.inheritedCapId || undefined,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
        percentComplete: form.percentComplete,
        findingClosed: form.findingClosed,
        effectivenessConfirmed: form.effectivenessConfirmed,
        followUpClosureDate: form.followUpClosureDate || null,
        closureVerificationMethod: form.closureVerificationMethod || null,
      },
      csrfToken: authStore.csrfToken,
    });

    const createdFollowUpId = created?.followUpReport?.followUpId;
    if (createdFollowUpId && stagedEvidenceFiles.value.length) {
      await uploadStagedEvidence({ findingId: form.findingId, followUpId: createdFollowUpId });
    }

    message.value = t('followUpManager.toast.created');
    form.inheritedCapId = '';
    form.followUpDate = '';
    form.percentComplete = 0;
    form.findingClosed = false;
    form.effectivenessConfirmed = false;
    form.followUpClosureDate = '';
    form.closureVerificationMethod = '';
    stagedEvidenceFiles.value = [];
    await loadFollowUps();
  } catch (error) {
    console.error('Follow-up creation failed:', error);
    searchErrorMessage.value = error?.message || t('followUpManager.toast.createError');
  }
}

function viewFollowUp(followUp) {
  message.value = '';
  showEvidenceReviewForm.value = false;
  selectedFollowUp.value = followUp;
  evidenceReviewForm.findingId = followUp.findingId;
  evidenceReviewForm.followUpId = followUp.followUpId;
  evidenceReviewForm.decision = 'Adequate';
  evidenceReviewForm.notes = '';
}

function closeFollowUpDetail() {
  selectedFollowUp.value = null;
  showEvidenceReviewForm.value = false;
}

function viewFollowUpEvidence(item) {
  window.open(
    apiFollowUpEvidenceContentUrl(selectedFollowUp.value.findingId, selectedFollowUp.value.followUpId, item.nodeId),
    '_blank',
    'noopener'
  );
}

async function reviewEvidence() {
  message.value = '';
  try {
    await followUpStore.reviewEvidence({
      findingId: evidenceReviewForm.findingId,
      followUpId: evidenceReviewForm.followUpId,
      decision: evidenceReviewForm.decision,
      notes: evidenceReviewForm.notes,
      csrfToken: authStore.csrfToken,
    });
    message.value = t('followUpManager.toast.evidenceReviewApplied');
    showEvidenceReviewForm.value = false;
    closeFollowUpDetail();
    await loadFollowUps();
  } catch (error) {
    console.error('Evidence review failed:', error);
    searchErrorMessage.value = error?.message || t('followUpManager.toast.evidenceReviewError');
  }
}

onMounted(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    form.findingId = findingId;
    scope.findingId = findingId;
  }
  await loadFollowUps();
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

.field-span-2 {
  grid-column: 1 / -1;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-gray-900);
  box-sizing: border-box;
}

.form-grid input[type="checkbox"] {
  width: auto;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.error-message {
  color: var(--color-error-700);
}

.success-message {
  color: var(--color-success-700);
}

.detail-buttons {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.detail-panel p {
  margin: var(--space-1) 0;
}

.evidence-list {
  margin-top: var(--space-2);
}

.evidence-list-title {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.evidence-list-empty {
  color: var(--color-gray-500);
  font-size: var(--text-sm);
}

.evidence-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.evidence-list li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--color-gray-50);
}

.evidence-name {
  flex: 1;
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.evidence-meta {
  font-size: var(--text-sm);
  color: var(--color-gray-500);
}

.evidence-review-panel {
  margin-top: var(--space-4);
  border-top: 1px dashed var(--border-color);
  padding-top: var(--space-3);
}

.push-button-active {
  background-color: var(--color-primary-700);
  color: var(--color-white);
  border-color: var(--color-primary-700);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }

  .form-actions {
    justify-content: flex-start;
  }
}
</style>
