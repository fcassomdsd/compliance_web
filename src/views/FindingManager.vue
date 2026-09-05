<template>
  <BaseManager :title="t('app.nav.findings')">
    <div v-if="findingStore.error" class="error-message">{{ findingStore.error }}</div>

    <section class="card">
      <h3>{{ t('findingManager.listing') }}</h3>
      <ScopePicker
        v-model="scope"
        mode="findings"
        :title="t('findingManager.scope')"
        :loading="findingStore.loading"
        :presets="findingPresets"
        :show-provider-id="true"
        :show-location-id="true"
        :show-specialty-code="true"
        :show-inspection-id="true"
        :show-domain="true"
        :show-status="true"
        :show-cap-overdue-only="true"
        :show-solution-overdue-only="true"
        @search="loadFindings"
        @reset="loadFindings"
      />

      <table class="data-table">

        <colgroup>
          <col style="width: 12%;">
          <col style="width: 10%;">
          <col style="width: 12%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
          <col style="width: 10%;">
        </colgroup>
        <thead>
          <tr>
            <th>{{ t('findingManager.findingId') }}</th>
            <th>{{ t('findingManager.level') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('findingManager.capDeadline') }}</th>
            <th>{{ t('providerHistory.table.resolutionDeadline') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="finding in findingStore.findings" :key="finding.findingId">
            <td>{{ finding.findingId }}</td>
            <td>{{ finding.findingLevel }}</td>
            <td>
              {{ finding.effectiveStatus }}
              <span v-if="finding.statusDivergence" class="divergence-badge">{{ t('findingManager.calculated') }}</span>
              <span v-if="finding.capOverdue && finding.effectiveStatus !== 'CAP Overdue'" class="cap-overdue-badge">{{ t('findingManager.capAlsoOverdue') }}</span>
            </td>
            <td>{{ formatDate(finding.submissionDeadline) || '-' }}</td>
            <td>{{ formatDate(finding.resolutionDeadline) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="viewDetail(finding.findingId)">{{ t('common.view') }}</BaseButton>
              <BaseButton variant="ghost" size="sm" @click="goToFollowUps(finding.findingId)">{{ t('app.nav.followUps') }}</BaseButton>
              <BaseButton
                v-if="isReviewable(finding)"
                variant="ghost"
                size="sm"
                @click="startReview(finding.findingId)"
              >{{ t('findingManager.review') }}</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="findingStore.selectedFinding && !reviewMode" class="card detail-panel">
      <h3>{{ t('findingManager.findingDetail') }}: {{ findingStore.selectedFinding.findingId }}</h3>
      <p><strong>{{ t('common.description') }}</strong> {{ findingStore.selectedFinding.description || '-' }}</p>
      <p><strong>{{ t('findingManager.requirementBreached') }}</strong> {{ findingStore.selectedFinding.requirementBreached || '-' }}</p>
      <p><strong>{{ t('findingManager.opened') }}</strong> {{ formatDate(findingStore.selectedFinding.openedDate) || '-' }}</p>
      <p><strong>{{ t('findingManager.lastStatusChange') }}</strong> {{ formatDate(findingStore.selectedFinding.lastStatusChange) || '-' }}</p>
      <p v-if="findingStore.selectedFinding.statusDivergence" class="warning-text">
        {{ t('findingManager.statusDivergenceWarning') }}
      </p>
      <BaseButton variant="primary" size="sm" @click="goToCaps(findingStore.selectedFinding.findingId)">{{ t('findingManager.openCapManager') }}</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="goToFollowUps(findingStore.selectedFinding.findingId)">{{ t('findingManager.openFollowUpManager') }}</BaseButton>
      <BaseButton
        v-if="isReviewable(findingStore.selectedFinding)"
        variant="ghost"
        size="sm"
        @click="startReview(findingStore.selectedFinding.findingId)"
      >{{ t('findingManager.review') }}</BaseButton>
    </section>

    <section v-if="findingStore.selectedFinding && reviewMode" class="card detail-panel">
      <h3>{{ t('findingManager.reviewFinding') }}: {{ findingStore.selectedFinding.findingId }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label>{{ t('findingManager.findingId') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.findingId }}</p>
        </div>
        <div class="form-field">
          <label>{{ t('findingManager.findingLevel') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.findingLevel }}</p>
        </div>
        <div class="form-field">
          <label>{{ t('findingManager.dateIssued') }}</label>
          <p class="readonly-value">{{ formatDate(findingStore.selectedFinding.dateIssued) || '-' }}</p>
        </div>
        <div class="form-field">
          <label>{{ t('findingManager.checklistItemCode') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.checklistItemCode || '-' }}</p>
        </div>
        <div class="form-field field-span-2">
          <label>{{ t('findingManager.requirementBreachedLabel') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.requirementBreached || '-' }}</p>
        </div>
        <div class="form-field field-span-2">
          <label>{{ t('common.description') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.description || '-' }}</p>
        </div>
        <div class="form-field">
          <label>{{ t('findingManager.nationalRegulation') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.nationalRegulation || '-' }}</p>
        </div>
        <div class="form-field">
          <label>{{ t('findingManager.regulationItem') }}</label>
          <p class="readonly-value">{{ findingStore.selectedFinding.regulationItem || '-' }}</p>
        </div>
        <div class="form-field">
          <label for="reviewFindingSeverity">{{ t('findingManager.findingSeverity') }}</label>
          <select id="reviewFindingSeverity" v-model="reviewSeverity">
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
      </div>

      <div class="evidence-section">
        <h4>{{ t('findingManager.evidence') }}</h4>
        <ul v-if="findingStore.selectedFinding.evidence?.length" class="evidence-list">
          <li v-for="item in findingStore.selectedFinding.evidence" :key="item.nodeId">
            <span class="evidence-name">{{ item.name }}</span>
            <BaseButton variant="ghost" size="sm" @click="viewFindingEvidence(item)">{{ t('common.view') }}</BaseButton>
          </li>
        </ul>
        <p v-else class="helper-text">{{ t('findingManager.noEvidence') }}</p>
      </div>

      <div class="form-actions">
        <BaseButton variant="ghost" @click="cancelReview">{{ t('common.cancel') }}</BaseButton>
        <BaseButton variant="primary" @click="confirmReview" :disabled="findingStore.loading">{{ t('findingManager.confirmReview') }}</BaseButton>
      </div>
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showClosureForm }" @click="showClosureForm = !showClosureForm">{{ t('findingManager.closureReview') }}</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showExtensionRequestForm }" @click="showExtensionRequestForm = !showExtensionRequestForm">{{ t('findingManager.requestExtension') }}</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showExtensionReviewForm }" @click="showExtensionReviewForm = !showExtensionReviewForm">{{ t('findingManager.reviewExtension') }}</BaseButton>
    </div>

    <section v-if="showClosureForm" class="card">
      <h3>{{ t('findingManager.closureReview') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="closureFindingId">{{ t('findingManager.findingId') }}</label>
          <input id="closureFindingId" v-model="closureForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="closureDecision">{{ t('findingManager.decision') }}</label>
          <select id="closureDecision" v-model="closureForm.decision">
            <option value="approve">{{ t('findingManager.approve') }}</option>
            <option value="reject">{{ t('findingManager.reject') }}</option>
          </select>
        </div>
      </div>
      <BaseButton variant="primary" @click="closureReview" :disabled="findingStore.loading">{{ t('findingManager.applyDecision') }}</BaseButton>
    </section>

    <section v-if="showExtensionRequestForm" class="card">
      <h3>{{ t('findingManager.requestExtension') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="extensionRequestFindingId">{{ t('findingManager.findingId') }}</label>
          <input id="extensionRequestFindingId" v-model="extensionRequestForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="requestedResolutionDeadline">{{ t('findingManager.requestedResolutionDeadline') }}</label>
          <input id="requestedResolutionDeadline" v-model="extensionRequestForm.requestedResolutionDeadline" type="date" />
        </div>
        <div class="form-field field-span-2">
          <label for="extensionReason">{{ t('findingManager.reason') }}</label>
          <textarea id="extensionReason" v-model="extensionRequestForm.reason" rows="2" />
        </div>
      </div>
      <BaseButton variant="primary" @click="requestExtension" :disabled="findingStore.loading">{{ t('findingManager.submitRequest') }}</BaseButton>
    </section>

    <section v-if="showExtensionReviewForm" class="card">
      <h3>{{ t('findingManager.reviewExtension') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="extensionReviewFindingId">{{ t('findingManager.findingId') }}</label>
          <input id="extensionReviewFindingId" v-model="extensionReviewForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="extensionReviewDecision">{{ t('findingManager.decision') }}</label>
          <select id="extensionReviewDecision" v-model="extensionReviewForm.decision">
            <option value="Accepted">{{ t('findingManager.accepted') }}</option>
            <option value="Rejected">{{ t('findingManager.rejected') }}</option>
          </select>
        </div>
      </div>
      <BaseButton variant="primary" @click="reviewExtension" :disabled="findingStore.loading">{{ t('findingManager.applyDecision') }}</BaseButton>
    </section>

    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useFindingStore } from '@/stores/findingStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';
import { apiFindingEvidenceContentUrl } from '@/services/apiServices';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const findingStore = useFindingStore();
const authStore = useAuthStore();

const message = ref('');
const showClosureForm = ref(false);
const showExtensionRequestForm = ref(false);
const showExtensionReviewForm = ref(false);

const reviewMode = ref(false);
const reviewSeverity = ref('A');

const closureForm = reactive({
  findingId: '',
  decision: 'approve',
});

const extensionRequestForm = reactive({
  findingId: '',
  requestedResolutionDeadline: '',
  reason: '',
});

const extensionReviewForm = reactive({
  findingId: '',
  decision: 'Accepted',
});

function isReviewable(finding) {
  return finding?.findingLevel === 'Non-Compliance' && finding?.findingReviewStatus !== 'Confirmed';
}

async function startReview(findingId) {
  reviewMode.value = true;
  await findingStore.fetchFindingDetail(findingId);
  reviewSeverity.value = findingStore.selectedFinding?.findingSeverity || 'A';
}

function cancelReview() {
  reviewMode.value = false;
}

async function confirmReview() {
  message.value = '';
  const findingId = findingStore.selectedFinding?.findingId;
  if (!findingId) {
    return;
  }
  try {
    await findingStore.reviewFinding({
      findingId,
      edits: { findingSeverity: reviewSeverity.value },
      csrfToken: authStore.csrfToken,
    });
    message.value = t('findingManager.toast.reviewConfirmed');
    reviewMode.value = false;
    await findingStore.fetchFindingDetail(findingId);
    await loadFindings();
  } catch (error) {
    console.error('Finding review failed:', error);
  }
}

function viewFindingEvidence(item) {
  const findingId = findingStore.selectedFinding?.findingId;
  if (!findingId) {
    return;
  }
  window.open(apiFindingEvidenceContentUrl(findingId, item.nodeId), '_blank', 'noopener');
}

async function closureReview() {
  message.value = '';
  try {
    await findingStore.closureReviewFinding({
      findingId: closureForm.findingId,
      decision: closureForm.decision,
      csrfToken: authStore.csrfToken,
    });
    message.value = t('findingManager.toast.closureApplied');
    closureForm.findingId = '';
    await loadFindings();
  } catch (error) {
    console.error('Closure review failed:', error);
  }
}

async function requestExtension() {
  message.value = '';
  try {
    await findingStore.requestDeadlineExtension({
      findingId: extensionRequestForm.findingId,
      payload: {
        requestedResolutionDeadline: extensionRequestForm.requestedResolutionDeadline,
        reason: extensionRequestForm.reason,
      },
      csrfToken: authStore.csrfToken,
    });
    message.value = t('findingManager.toast.extensionRequested');
    extensionRequestForm.findingId = '';
    extensionRequestForm.requestedResolutionDeadline = '';
    extensionRequestForm.reason = '';
    await loadFindings();
  } catch (error) {
    console.error('Deadline extension request failed:', error);
  }
}

async function reviewExtension() {
  message.value = '';
  try {
    await findingStore.reviewDeadlineExtension({
      findingId: extensionReviewForm.findingId,
      decision: extensionReviewForm.decision,
      csrfToken: authStore.csrfToken,
    });
    message.value = t('findingManager.toast.extensionReviewed');
    extensionReviewForm.findingId = '';
    await loadFindings();
  } catch (error) {
    console.error('Deadline extension review failed:', error);
  }
}

const findingPresets = [
  { value: 'open-findings', label: t('findingManager.presets.open') },
  { value: 'closed-findings', label: t('findingManager.presets.closed') },
  { value: 'all-findings', label: t('findingManager.presets.all') },
  { value: 'solution-overdue-findings', label: t('findingManager.presets.solutionOverdue') },
  { value: 'cap-overdue-findings', label: t('findingManager.presets.capOverdue') },
];

let scope = reactive({
  preset: '',
  findingId: '',
  status: '',
  inspectionId: '',
  providerId: '',
  locationId: '',
  specialtyCode: '',
  domain: '',
  capOverdueOnly: false,
  solutionOverdueOnly: false,
});

function normalizeFindingScope(currentScope) {
  const resolved = { ...currentScope };

  switch (resolved.preset) {
    case 'open-findings':
      resolved.status = 'Open';
      resolved.capOverdueOnly = false;
      resolved.solutionOverdueOnly = false;
      break;
    case 'closed-findings':
      resolved.status = 'Closed';
      resolved.capOverdueOnly = false;
      resolved.solutionOverdueOnly = false;
      break;
    case 'all-findings':
      resolved.status = '';
      resolved.capOverdueOnly = false;
      resolved.solutionOverdueOnly = false;
      break;
    case 'solution-overdue-findings':
      resolved.status = '';
      resolved.capOverdueOnly = false;
      resolved.solutionOverdueOnly = true;
      break;
    case 'cap-overdue-findings':
      resolved.status = '';
      resolved.capOverdueOnly = true;
      resolved.solutionOverdueOnly = false;
      break;
    default:
      break;
  }

  return resolved;
}

async function loadFindings() {
  const resolvedScope = normalizeFindingScope(scope);

  findingStore.setFilter('findingId', resolvedScope.findingId);
  findingStore.setFilter('status', resolvedScope.status);
  findingStore.setFilter('inspectionId', resolvedScope.inspectionId);
  findingStore.setFilter('providerId', resolvedScope.providerId);
  findingStore.setFilter('locationId', resolvedScope.locationId);
  findingStore.setFilter('specialtyCode', resolvedScope.specialtyCode);
  findingStore.setFilter('domain', resolvedScope.domain);
  findingStore.setFilter('capOverdueOnly', resolvedScope.capOverdueOnly);
  findingStore.setFilter('solutionOverdueOnly', resolvedScope.solutionOverdueOnly);
  await findingStore.fetchFindings();
}

async function viewDetail(findingId) {
  reviewMode.value = false;
  await findingStore.fetchFindingDetail(findingId);
}

function goToCaps(findingId) {
  router.push({ name: 'correctiveActions', query: { findingId } });
}

function goToFollowUps(findingId) {
  router.push({ name: 'followUps', query: { findingId } });
}

onMounted(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    scope.findingId = findingId;
  }
  await loadFindings();
});
</script>

<style scoped>
.divergence-badge {
  margin-left: var(--space-2);
  background: var(--color-warning-100);
  color: var(--color-warning-700);
  padding: 0.12rem 0.35rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.cap-overdue-badge {
  margin-left: var(--space-2);
  background: var(--color-warning-100);
  color: var(--color-warning-700);
  padding: 0.12rem 0.35rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-white);
  margin-bottom: var(--space-4);
}

.detail-panel {
  border-color: var(--color-primary-500);
}

.warning-text {
  color: var(--color-warning-700);
}

.error-message {
  color: var(--color-error-700);
}

.success-message {
  color: var(--color-success-700);
}

.detail-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.push-button-active {
  background-color: var(--color-primary-700);
  color: var(--color-white);
  border-color: var(--color-primary-700);
}

.readonly-value {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-gray-100);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--color-gray-900);
  min-height: 1.2em;
}

.evidence-section {
  margin-top: var(--space-3);
  margin-bottom: var(--space-3);
}

.evidence-list {
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

.helper-text {
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
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

.form-grid textarea {
  resize: vertical;
  min-height: 60px;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }
}
</style>