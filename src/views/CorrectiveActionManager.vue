<template>
  <BaseManager title="Corrective Actions">
    <section class="card">
      <h3>CAP Listing</h3>
      <ScopePicker
        v-model="scope"
        mode="caps"
        title="CAP Scope"
        :loading="capStore.loading"
        :presets="capScopePresets"
        :show-finding-id="false"
        :show-provider-id="true"
        :show-location-id="true"
        :show-specialty-code="false"
        :show-inspection-id="true"
        :show-domain="true"
        :show-status="false"
        :show-cap-overdue-only="false"
        :show-solution-overdue-only="false"
        :show-follow-up-type="false"
        :show-acceptance-status="true"
        :acceptance-status-options="capAcceptanceStatuses"
        @search="loadCaps"
        @reset="loadCaps"
      />

      <table class="data-table">
        <thead>
          <tr>
            <th>CAP ID</th>
            <th>Acceptance Status</th>
            <th>Responsible Entity</th>
            <th>Due Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cap in capStore.caps" :key="cap.capId">
            <td>{{ cap.capId }}</td>
            <td>{{ cap.acceptanceStatus }}</td>
            <td>{{ cap.responsibleEntity }}</td>
            <td>{{ cap.dueDate || '-' }}</td>
            <td><BaseButton variant="ghost" size="sm" @click="viewCap(cap.capId)">View</BaseButton></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.selectedCap" class="card detail-panel">
      <h3>CAP Detail: {{ capStore.selectedCap.capId }}</h3>
      <p><strong>Acceptance status:</strong> {{ capStore.selectedCap.acceptanceStatus || '-' }}</p>
      <p><strong>Due date:</strong> {{ capStore.selectedCap.dueDate || '-' }}</p>
      <p><strong>Action items:</strong> {{ capStore.selectedCap.correctiveActions?.length || 0 }}</p>
      <p><strong>Follow-up reports:</strong> {{ capStore.selectedCap.followUpReports?.length || 0 }}</p>

      <div v-if="capStore.selectedCap.rootCauseAnalysis" class="sub-section">
        <h4>Root Cause Analysis</h4>
        <p><strong>Method:</strong> {{ capStore.selectedCap.rootCauseAnalysis.method || '-' }}</p>
        <p v-if="capStore.selectedCap.rootCauseAnalysis.otherMethodDescription"><strong>Other method:</strong> {{ capStore.selectedCap.rootCauseAnalysis.otherMethodDescription }}</p>
        <p><strong>Main category:</strong> {{ capStore.selectedCap.rootCauseAnalysis.mainCategory || '-' }}</p>
        <p><strong>Root cause:</strong> {{ capStore.selectedCap.rootCauseAnalysis.rootCause || '-' }}</p>
        <p><strong>Contributing factors:</strong> {{ capStore.selectedCap.rootCauseAnalysis.contributingFactors || '-' }}</p>
        <div class="evidence-upload">
          <input type="file" @change="onEvidenceFileChange($event, 'rcaDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!rcaDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('rca')">Upload RCA Evidence</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.riskAssessment" class="sub-section">
        <h4>Risk Assessment</h4>
        <p><strong>Identified hazard:</strong> {{ capStore.selectedCap.riskAssessment.identifiedHazard || '-' }}</p>
        <p><strong>Potential consequence:</strong> {{ capStore.selectedCap.riskAssessment.potentialConsequence || '-' }}</p>
        <p><strong>Probability:</strong> {{ capStore.selectedCap.riskAssessment.probability || '-' }}</p>
        <p><strong>Severity:</strong> {{ capStore.selectedCap.riskAssessment.severity || '-' }}</p>
        <p><strong>Calculated risk level:</strong> {{ capStore.selectedCap.riskAssessment.calculatedRiskLevel || '-' }}</p>
        <p><strong>Tolerability level:</strong> {{ capStore.selectedCap.riskAssessment.tolerabilityLevel || '-' }}</p>
        <p><strong>Justification:</strong> {{ capStore.selectedCap.riskAssessment.justification || '-' }}</p>
        <div class="evidence-upload">
          <input type="file" @change="onEvidenceFileChange($event, 'riskDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!riskDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('risk-assessment')">Upload Risk Assessment Evidence</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.correctiveActions?.length" class="sub-section">
        <h4>Corrective Actions</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Priority</th>
              <th>Responsible</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Closure Date</th>
              <th>Closure Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in capStore.selectedCap.correctiveActions" :key="item.sequenceNumber">
              <td>{{ item.sequenceNumber }}</td>
              <td>{{ item.description }}</td>
              <td>{{ item.priority || '-' }}</td>
              <td>{{ item.responsiblePerson }}</td>
              <td>{{ item.deadline }}</td>
              <td>
                <select v-model="item.itemStatus">
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </td>
              <td><input v-model="item.closureDate" type="date" :disabled="item.itemStatus !== 'Closed'" /></td>
              <td><input v-model="item.closureNotes" type="text" /></td>
              <td><BaseButton variant="ghost" size="sm" :disabled="capStore.loading" @click="updateActionItem(item)">Update</BaseButton></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="capStore.selectedCap.residualRisk" class="sub-section">
        <h4>Expected Residual Risk</h4>
        <p><strong>Probability:</strong> {{ capStore.selectedCap.residualRisk.probability || '-' }}</p>
        <p><strong>Severity:</strong> {{ capStore.selectedCap.residualRisk.severity || '-' }}</p>
        <p><strong>Residual risk level:</strong> {{ capStore.selectedCap.residualRisk.riskLevel || '-' }}</p>
        <p><strong>Justification:</strong> {{ capStore.selectedCap.residualRisk.justification || '-' }}</p>
      </div>

      <div v-if="capStore.selectedCap.effectivenessVerification" class="sub-section">
        <h4>Effectiveness Verification</h4>
        <p><strong>Method:</strong> {{ capStore.selectedCap.effectivenessVerification.method || '-' }}</p>
        <p><strong>Indicators:</strong> {{ capStore.selectedCap.effectivenessVerification.indicators || '-' }}</p>
        <p><strong>Projected verification date:</strong> {{ capStore.selectedCap.effectivenessVerification.projectedVerificationDate || '-' }}</p>
      </div>
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showSubmit }" @click="showSubmit = !showSubmit">Submit CAP</BaseButton>
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showReview }" @click="showReview = !showReview">Review CAP</BaseButton>
    </div>

    <div v-if="showSubmit" class="card cap-submit-panel">
      <h3>Submit CAP</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="findingId">Finding ID</label>
          <input id="findingId" v-model="capForm.findingId" type="text" />
        </div>
        <div class="form-field">
          <label for="dueDate">Due Date</label>
          <input id="dueDate" v-model="capForm.dueDate" type="date" />
        </div>
        <div class="form-field field-span-2">
          <p class="helper-text">CAP ID is auto-generated from the finding and existing CAP sequence. Action descriptions and responsible people are captured in the action-item rows below.</p>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">1. Root Cause Analysis</h4>
        <div class="form-grid">
          <div class="form-field">
            <label for="rcaMethod">Method used</label>
            <select id="rcaMethod" v-model="capForm.rootCauseAnalysis.method">
              <option v-for="method in rcaMethods" :key="method" :value="method">{{ method }}</option>
            </select>
          </div>
          <div v-if="capForm.rootCauseAnalysis.method === 'Other'" class="form-field">
            <label for="rcaOtherMethodDescription">Other method description</label>
            <input id="rcaOtherMethodDescription" v-model="capForm.rootCauseAnalysis.otherMethodDescription" type="text" />
          </div>
          <div class="form-field">
            <label for="rcaMainCategory">Main category</label>
            <input id="rcaMainCategory" v-model="capForm.rootCauseAnalysis.mainCategory" type="text" />
          </div>
          <div class="form-field field-span-2">
            <label for="rootCause">Root cause</label>
            <textarea id="rootCause" v-model="capForm.rootCauseAnalysis.rootCause" rows="2" />
          </div>
          <div class="form-field field-span-2">
            <label for="contributingFactors">Contributing factors</label>
            <textarea id="contributingFactors" v-model="capForm.rootCauseAnalysis.contributingFactors" rows="2" />
          </div>
          <div class="form-field">
            <label for="rcaEvidence">Evidence of RCA</label>
            <input id="rcaEvidence" type="file" @change="onEvidenceFileChange($event, 'rca')" />
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">2. Risk Assessment</h4>
        <div class="form-grid">
          <div class="form-field">
            <label for="raHazard">Identified hazard</label>
            <input id="raHazard" v-model="capForm.riskAssessment.hazard" type="text" />
          </div>
          <div class="form-field">
            <label for="raConsequence">Potential consequence</label>
            <input id="raConsequence" v-model="capForm.riskAssessment.consequence" type="text" />
          </div>
          <div class="form-field">
            <label for="raProbability">Probability</label>
            <input id="raProbability" v-model="capForm.riskAssessment.probability" type="text" />
          </div>
          <div class="form-field">
            <label for="raSeverity">Severity</label>
            <input id="raSeverity" v-model="capForm.riskAssessment.severity" type="text" />
          </div>
          <div class="form-field">
            <label for="raCalculatedRiskLevel">Calculated risk level</label>
            <input id="raCalculatedRiskLevel" v-model="capForm.riskAssessment.calculatedRiskLevel" type="text" />
          </div>
          <div class="form-field">
            <label for="raTolerabilityLevel">Tolerability level</label>
            <input id="raTolerabilityLevel" v-model="capForm.riskAssessment.tolerabilityLevel" type="text" />
          </div>
          <div class="form-field field-span-2">
            <label for="raJustification">Justification</label>
            <textarea id="raJustification" v-model="capForm.riskAssessment.justification" rows="2" />
          </div>
          <div class="form-field">
            <label for="raEvidence">Evidence</label>
            <input id="raEvidence" type="file" @change="onEvidenceFileChange($event, 'risk')" />
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">3. Corrective Actions</h4>
        <div class="action-item-head" aria-hidden="true">
          <span>#</span>
          <span>Description</span>
          <span>Priority</span>
          <span>Responsible</span>
          <span>Deadline</span>
          <span></span>
        </div>
        <div v-for="(item, index) in capForm.correctiveActions" :key="index" class="action-item-card">
          <div class="action-item-row">
            <span class="action-seq">{{ index + 1 }}</span>
            <input :id="`actionDescription-${index}`" v-model="item.description" type="text" :aria-label="`Action ${index + 1} description`" />
            <select :id="`actionPriority-${index}`" v-model="item.priority" :aria-label="`Action ${index + 1} priority`">
              <option v-for="priority in actionPriorities" :key="priority" :value="priority">{{ priority }}</option>
            </select>
            <input :id="`actionResponsiblePerson-${index}`" v-model="item.responsiblePerson" type="text" :aria-label="`Action ${index + 1} responsible person`" />
            <input :id="`actionDeadline-${index}`" v-model="item.deadline" type="date" :aria-label="`Action ${index + 1} deadline`" />
            <BaseButton variant="ghost" size="sm" :disabled="capForm.correctiveActions.length <= 1" @click="removeCorrectiveAction(index)">Remove</BaseButton>
          </div>
        </div>
        <div class="form-actions">
          <BaseButton variant="ghost" size="sm" @click="addCorrectiveAction">Add corrective action</BaseButton>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">4. Expected Residual Risk</h4>
        <div class="form-grid">
          <div class="form-field">
            <label for="residualProbability">Probability</label>
            <input id="residualProbability" v-model="capForm.residualRisk.probability" type="text" />
          </div>
          <div class="form-field">
            <label for="residualSeverity">Severity</label>
            <input id="residualSeverity" v-model="capForm.residualRisk.severity" type="text" />
          </div>
          <div class="form-field field-span-2">
            <label for="residualRiskLevel">Residual risk level</label>
            <input id="residualRiskLevel" v-model="capForm.residualRisk.riskLevel" type="text" />
          </div>
          <div class="form-field field-span-2">
            <label for="residualJustification">Justification</label>
            <textarea id="residualJustification" v-model="capForm.residualRisk.justification" rows="2" />
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">5. Effectiveness Verification</h4>
        <div class="form-grid">
          <div class="form-field">
            <label for="verificationMethod">Method</label>
            <input id="verificationMethod" v-model="capForm.effectivenessVerification.method" type="text" />
          </div>
          <div class="form-field">
            <label for="verificationIndicators">Indicator(s)</label>
            <textarea id="verificationIndicators" v-model="capForm.effectivenessVerification.indicators" rows="2" />
          </div>
          <div class="form-field">
            <label for="projectedVerificationDate">Projected date of verification</label>
            <input id="projectedVerificationDate" v-model="capForm.effectivenessVerification.projectedVerificationDate" type="date" />
          </div>
        </div>
      </div>

      <div class="form-actions">
        <BaseButton variant="primary" @click="submitCap" :disabled="capStore.loading">Submit CAP</BaseButton>
      </div>
    </div>

    <div v-if="showReview" class="card">
      <h3>Review CAP</h3>
      <div class="form-grid">
        <label for="reviewCapId">CAP ID</label>
        <input id="reviewCapId" v-model="reviewForm.capId" type="text" />

        <label for="acceptanceStatus">Acceptance Status</label>
        <select id="acceptanceStatus" v-model="reviewForm.acceptanceStatus">
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Returned for Revision">Returned for Revision</option>
        </select>
      </div>
      <BaseButton variant="primary" @click="reviewCap" :disabled="capStore.loading">Apply Review</BaseButton>
    </div>

    <p v-if="capStore.error" class="error-message">{{ capStore.error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useCapStore } from '@/stores/capStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const capStore = useCapStore();
const authStore = useAuthStore();

const message = ref('');
const showSubmit = ref(false);
const showReview = ref(false);

const rcaMethods = ['5 Whys', 'Fishbone', 'BowTie', 'TapRooT', 'Barrier Analysis', 'Other'];
const actionPriorities = ['High', 'Medium', 'Low'];

function emptyCorrectiveAction() {
  return {
    description: '',
    priority: 'Medium',
    responsiblePerson: '',
    deadline: '',
  };
}

const capForm = reactive({
  findingId: '',
  dueDate: '',
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
  correctiveActions: [emptyCorrectiveAction()],
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
});

const rcaEvidenceFile = ref(null);
const riskEvidenceFile = ref(null);
const rcaDetailEvidenceFile = ref(null);
const riskDetailEvidenceFile = ref(null);

function onEvidenceFileChange(event, target) {
  const file = event.target.files?.[0] || null;
  if (target === 'rca') {
    rcaEvidenceFile.value = file;
  } else if (target === 'risk') {
    riskEvidenceFile.value = file;
  } else if (target === 'rcaDetail') {
    rcaDetailEvidenceFile.value = file;
  } else if (target === 'riskDetail') {
    riskDetailEvidenceFile.value = file;
  }
}

function addCorrectiveAction() {
  capForm.correctiveActions.push(emptyCorrectiveAction());
}

function removeCorrectiveAction(index) {
  if (capForm.correctiveActions.length > 1) {
    capForm.correctiveActions.splice(index, 1);
  }
}

const reviewForm = reactive({
  capId: '',
  acceptanceStatus: 'Accepted',
});

const capScopePresets = [
  { value: 'all-caps', label: 'All CAPs' },
  { value: 'pending-caps', label: 'Pending review' },
  { value: 'accepted-caps', label: 'Accepted' },
  { value: 'rejected-caps', label: 'Rejected' },
  { value: 'returned-caps', label: 'Returned for revision' },
];

const capAcceptanceStatuses = [
  'Pending Review',
  'Accepted',
  'Rejected',
  'Returned for Revision',
];

let scope = reactive({
  preset: '',
  acceptanceStatus: '',
  locationId: '',
  providerId: '',
  inspectionId: '',
  domain: '',
});

function normalizeCapScope(currentScope) {
  const resolved = { ...currentScope };

  switch (resolved.preset) {
    case 'pending-caps':
      resolved.acceptanceStatus = 'Pending Review';
      break;
    case 'accepted-caps':
      resolved.acceptanceStatus = 'Accepted';
      break;
    case 'rejected-caps':
      resolved.acceptanceStatus = 'Rejected';
      break;
    case 'returned-caps':
      resolved.acceptanceStatus = 'Returned for Revision';
      break;
    case 'all-caps':
      resolved.acceptanceStatus = '';
      break;
    default:
      break;
  }

  return resolved;
}

async function loadCaps() {
  const resolvedScope = normalizeCapScope(scope);

  capStore.setFilter('acceptanceStatus', resolvedScope.acceptanceStatus);
  capStore.setFilter('locationId', resolvedScope.locationId);
  capStore.setFilter('providerId', resolvedScope.providerId);
  capStore.setFilter('inspectionId', resolvedScope.inspectionId);
  capStore.setFilter('domain', resolvedScope.domain);
  await capStore.fetchCaps();
}

async function submitCap() {
  message.value = '';
  try {
    const { cap } = await capStore.submitCap({
      findingId: capForm.findingId,
      payload: {
        dueDate: capForm.dueDate,
        rootCauseAnalysis: { ...capForm.rootCauseAnalysis },
        riskAssessment: { ...capForm.riskAssessment },
        correctiveActions: capForm.correctiveActions.map((item) => ({ ...item })),
        residualRisk: { ...capForm.residualRisk },
        effectivenessVerification: { ...capForm.effectivenessVerification },
      },
      csrfToken: authStore.csrfToken,
    });

    if (rcaEvidenceFile.value && cap?.capId) {
      await capStore.uploadCapEvidence({
        capId: cap.capId,
        section: 'rca',
        file: rcaEvidenceFile.value,
        csrfToken: authStore.csrfToken,
      });
    }
    if (riskEvidenceFile.value && cap?.capId) {
      await capStore.uploadCapEvidence({
        capId: cap.capId,
        section: 'risk-assessment',
        file: riskEvidenceFile.value,
        csrfToken: authStore.csrfToken,
      });
    }

    message.value = 'CAP submitted successfully.';
    capForm.findingId = '';
    capForm.dueDate = '';
    capForm.rootCauseAnalysis = { method: '5 Whys', otherMethodDescription: '', mainCategory: '', rootCause: '', contributingFactors: '' };
    capForm.riskAssessment = { hazard: '', consequence: '', probability: '', severity: '', calculatedRiskLevel: '', tolerabilityLevel: '', justification: '' };
    capForm.correctiveActions = [emptyCorrectiveAction()];
    capForm.residualRisk = { probability: '', severity: '', riskLevel: '', justification: '' };
    capForm.effectivenessVerification = { method: '', indicators: '', projectedVerificationDate: '' };
    rcaEvidenceFile.value = null;
    riskEvidenceFile.value = null;
    await loadCaps();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP submission failed:', error);
  }
}

async function updateActionItem(item) {
  message.value = '';
  try {
    await capStore.updateActionItem({
      capId: capStore.selectedCap.capId,
      sequenceNumber: item.sequenceNumber,
      patch: {
        itemStatus: item.itemStatus,
        closureDate: item.closureDate,
        closureNotes: item.closureNotes,
      },
      csrfToken: authStore.csrfToken,
    });
    message.value = `Action #${item.sequenceNumber} updated.`;
    await viewCap(capStore.selectedCap.capId);
  } catch (error) {
    console.error('Action item update failed:', error);
  }
}

async function uploadDetailEvidence(section) {
  message.value = '';
  const file = section === 'rca' ? rcaDetailEvidenceFile.value : riskDetailEvidenceFile.value;
  if (!file || !capStore.selectedCap?.capId) {
    return;
  }
  try {
    await capStore.uploadCapEvidence({
      capId: capStore.selectedCap.capId,
      section,
      file,
      csrfToken: authStore.csrfToken,
    });
    message.value = 'Evidence uploaded.';
    if (section === 'rca') {
      rcaDetailEvidenceFile.value = null;
    } else {
      riskDetailEvidenceFile.value = null;
    }
    await viewCap(capStore.selectedCap.capId);
  } catch (error) {
    console.error('Evidence upload failed:', error);
  }
}

async function reviewCap() {
  message.value = '';
  try {
    await capStore.reviewCap({
      capId: reviewForm.capId,
      acceptanceStatus: reviewForm.acceptanceStatus,
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP review updated.';
    reviewForm.capId = '';
    await loadCaps();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP review failed:', error);
  }
}

async function viewCap(capId) {
  await capStore.fetchCapDetail(capId);
}

onMounted(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    capForm.findingId = findingId;
  }
  await loadCaps();
});
</script>

<style scoped>
.split-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}

.card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-white);
  margin-bottom: var(--space-4);
}

.cap-submit-panel {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
  min-height: 84px;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.helper-text {
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.section-card {
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--color-gray-100);
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-primary-700);
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

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.push-button-active {
  background-color: var(--color-primary-700);
  color: var(--color-white);
  border-color: var(--color-primary-700);
}

.detail-panel {
  border-color: var(--color-primary-500);
}

.sub-section {
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
}

.evidence-upload {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.action-item-card {
  border-top: 1px dashed var(--border-color);
  padding-top: var(--space-3);
  margin-bottom: var(--space-3);
}

.action-item-head,
.action-item-row {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 2.3fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1.1fr) auto;
  gap: var(--space-3);
  align-items: center;
}

.action-item-head {
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-primary-700);
  font-weight: 600;
}

.action-item-row input,
.action-item-row select {
  width: 100%;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-sizing: border-box;
}

.action-seq {
  font-size: var(--text-sm);
  color: var(--color-gray-700);
  text-align: center;
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

  .action-item-head {
    display: none;
  }

  .action-item-row {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .action-seq {
    text-align: left;
  }
}
</style>