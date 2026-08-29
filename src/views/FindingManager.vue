<template>
  <BaseManager title="Findings">
    <div v-if="findingStore.error" class="error-message">{{ findingStore.error }}</div>

    <section class="card">
      <h3>Finding Listing</h3>
      <ScopePicker
        v-model="scope"
        mode="findings"
        title="Finding Scope"
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
            <th>Finding ID</th>
            <th>Level</th>
            <th>Status</th>
            <th>CAP Deadline</th>
            <th>Resolution Deadline</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="finding in findingStore.findings" :key="finding.findingId">
            <td>{{ finding.findingId }}</td>
            <td>{{ finding.findingLevel }}</td>
            <td>
              {{ finding.effectiveStatus }}
              <span v-if="finding.statusDivergence" class="divergence-badge">Calculated</span>
              <span v-if="finding.capOverdue && finding.effectiveStatus !== 'CAP Overdue'" class="cap-overdue-badge">CAP also overdue</span>
            </td>
            <td>{{ formatDate(finding.submissionDeadline) || '-' }}</td>
            <td>{{ formatDate(finding.resolutionDeadline) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="viewDetail(finding.findingId)">View</BaseButton>
              <BaseButton variant="ghost" size="sm" @click="goToFollowUps(finding.findingId)">Follow-ups</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="findingStore.selectedFinding" class="card detail-panel">
      <h3>Finding Detail: {{ findingStore.selectedFinding.findingId }}</h3>
      <p><strong>Description:</strong> {{ findingStore.selectedFinding.description || '-' }}</p>
      <p><strong>Requirement breached:</strong> {{ findingStore.selectedFinding.requirementBreached || '-' }}</p>
      <p><strong>Opened:</strong> {{ formatDate(findingStore.selectedFinding.openedDate) || '-' }}</p>
      <p><strong>Last status change:</strong> {{ formatDate(findingStore.selectedFinding.lastStatusChange) || '-' }}</p>
      <p v-if="findingStore.selectedFinding.statusDivergence" class="warning-text">
        Stored status differs from calculated status. Calculated status is shown in the listing.
      </p>
      <BaseButton variant="primary" size="sm" @click="goToCaps(findingStore.selectedFinding.findingId)">Open CAP Manager</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="goToFollowUps(findingStore.selectedFinding.findingId)">Open Follow-up Manager</BaseButton>
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showReviewForm }" @click="showReviewForm = !showReviewForm">Review Finding</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showClosureForm }" @click="showClosureForm = !showClosureForm">Closure Review</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showExtensionRequestForm }" @click="showExtensionRequestForm = !showExtensionRequestForm">Request Deadline Extension</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showExtensionReviewForm }" @click="showExtensionReviewForm = !showExtensionReviewForm">Review Deadline Extension</BaseButton>
    </div>

    <section v-if="showReviewForm" class="card">
      <h3>Review Finding</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="reviewFindingId">Finding ID</label>
          <input id="reviewFindingId" v-model="reviewForm.findingId" type="text" />
        </div>
        <div class="form-field field-span-2">
          <label for="reviewDescription">Description</label>
          <textarea id="reviewDescription" v-model="reviewForm.description" rows="2" />
        </div>
        <div class="form-field">
          <label for="reviewFindingLevel">Finding Level</label>
          <input id="reviewFindingLevel" v-model="reviewForm.findingLevel" type="text" />
        </div>
        <div class="form-field">
          <label for="reviewFindingSeverity">Finding Severity</label>
          <input id="reviewFindingSeverity" v-model="reviewForm.findingSeverity" type="text" />
        </div>
        <div class="form-field">
          <label for="reviewRiskClassification">Risk Classification</label>
          <input id="reviewRiskClassification" v-model="reviewForm.riskClassification" type="text" />
        </div>
        <div class="form-field">
          <label for="reviewTargetResidualRisk">Target Residual Risk</label>
          <input id="reviewTargetResidualRisk" v-model="reviewForm.targetResidualRisk" type="text" />
        </div>
        <div class="form-field field-span-2">
          <label for="reviewRequirementBreached">Requirement Breached</label>
          <textarea id="reviewRequirementBreached" v-model="reviewForm.requirementBreached" rows="2" />
        </div>
      </div>
      <BaseButton variant="primary" @click="reviewFinding" :disabled="findingStore.loading">Confirm Review</BaseButton>
    </section>

    <section v-if="showClosureForm" class="card">
      <h3>Closure Review</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="closureFindingId">Finding ID</label>
          <input id="closureFindingId" v-model="closureForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="closureDecision">Decision</label>
          <select id="closureDecision" v-model="closureForm.decision">
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
        </div>
      </div>
      <BaseButton variant="primary" @click="closureReview" :disabled="findingStore.loading">Apply Decision</BaseButton>
    </section>

    <section v-if="showExtensionRequestForm" class="card">
      <h3>Request Deadline Extension</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="extensionRequestFindingId">Finding ID</label>
          <input id="extensionRequestFindingId" v-model="extensionRequestForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="requestedResolutionDeadline">Requested Resolution Deadline</label>
          <input id="requestedResolutionDeadline" v-model="extensionRequestForm.requestedResolutionDeadline" type="date" />
        </div>
        <div class="form-field field-span-2">
          <label for="extensionReason">Reason</label>
          <textarea id="extensionReason" v-model="extensionRequestForm.reason" rows="2" />
        </div>
      </div>
      <BaseButton variant="primary" @click="requestExtension" :disabled="findingStore.loading">Submit Request</BaseButton>
    </section>

    <section v-if="showExtensionReviewForm" class="card">
      <h3>Review Deadline Extension</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="extensionReviewFindingId">Finding ID</label>
          <input id="extensionReviewFindingId" v-model="extensionReviewForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="extensionReviewDecision">Decision</label>
          <select id="extensionReviewDecision" v-model="extensionReviewForm.decision">
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>
      <BaseButton variant="primary" @click="reviewExtension" :disabled="findingStore.loading">Apply Decision</BaseButton>
    </section>

    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useFindingStore } from '@/stores/findingStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';

const router = useRouter();
const route = useRoute();
const findingStore = useFindingStore();
const authStore = useAuthStore();

const message = ref('');
const showReviewForm = ref(false);
const showClosureForm = ref(false);
const showExtensionRequestForm = ref(false);
const showExtensionReviewForm = ref(false);

const reviewForm = reactive({
  findingId: '',
  description: '',
  findingLevel: '',
  findingSeverity: '',
  riskClassification: '',
  targetResidualRisk: '',
  requirementBreached: '',
});

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

function buildReviewEdits() {
  const edits = {};
  for (const field of ['description', 'findingLevel', 'findingSeverity', 'riskClassification', 'targetResidualRisk', 'requirementBreached']) {
    if (reviewForm[field]) {
      edits[field] = reviewForm[field];
    }
  }
  return edits;
}

async function reviewFinding() {
  message.value = '';
  try {
    await findingStore.reviewFinding({
      findingId: reviewForm.findingId,
      edits: buildReviewEdits(),
      csrfToken: authStore.csrfToken,
    });
    message.value = 'Finding review confirmed.';
    reviewForm.findingId = '';
    reviewForm.description = '';
    reviewForm.findingLevel = '';
    reviewForm.findingSeverity = '';
    reviewForm.riskClassification = '';
    reviewForm.targetResidualRisk = '';
    reviewForm.requirementBreached = '';
    await loadFindings();
  } catch (error) {
    console.error('Finding review failed:', error);
  }
}

async function closureReview() {
  message.value = '';
  try {
    await findingStore.closureReviewFinding({
      findingId: closureForm.findingId,
      decision: closureForm.decision,
      csrfToken: authStore.csrfToken,
    });
    message.value = 'Closure review applied.';
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
    message.value = 'Deadline extension requested.';
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
    message.value = 'Deadline extension decision applied.';
    extensionReviewForm.findingId = '';
    await loadFindings();
  } catch (error) {
    console.error('Deadline extension review failed:', error);
  }
}

const findingPresets = [
  { value: 'open-findings', label: 'Open findings' },
  { value: 'closed-findings', label: 'Closed findings' },
  { value: 'all-findings', label: 'All findings' },
  { value: 'solution-overdue-findings', label: 'Solution overdue findings' },
  { value: 'cap-overdue-findings', label: 'CAP overdue findings' },
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