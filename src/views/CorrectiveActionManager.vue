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
            <td>{{ formatDate(cap.dueDate) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="viewCap(cap.capId)">View</BaseButton>
              <BaseButton v-if="isCapEditableStatus(cap.acceptanceStatus)" variant="ghost" size="sm" @click="editCap(cap)">Edit</BaseButton>
              <BaseButton v-if="isCapReviewable(cap.acceptanceStatus)" variant="ghost" size="sm" @click="startReview(cap.capId)">Review</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.drafts.length" class="card">
      <h3>My Draft CAPs</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Finding ID</th>
            <th>Last Saved</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="draft in capStore.drafts" :key="draft.draftId">
            <td>{{ draft.findingId }}</td>
            <td>{{ formatDate(draft.updatedAt) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="editDraft(draft)">Edit</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="capStore.loading" @click="deleteDraftAction(draft.draftId)">Delete</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.selectedCap" class="card detail-panel">
      <h3>CAP Detail: {{ capStore.selectedCap.capId }}</h3>
      <BaseButton v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" variant="ghost" size="sm" @click="editCap(capStore.selectedCap)">Edit</BaseButton>
      <BaseButton v-if="isCapReviewable(capStore.selectedCap.acceptanceStatus) && !reviewMode" variant="ghost" size="sm" @click="startReview(capStore.selectedCap.capId)">Review</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="closeCapDetail">Close</BaseButton>
      <p><strong>Acceptance status:</strong> {{ capStore.selectedCap.acceptanceStatus || '-' }}</p>
      <p><strong>Due date:</strong> {{ formatDate(capStore.selectedCap.dueDate) || '-' }}</p>
      <p><strong>Action items:</strong> {{ capStore.selectedCap.correctiveActions?.length || 0 }}</p>
      <p><strong>Follow-up reports:</strong> {{ capStore.selectedCap.followUpReports?.length || 0 }}</p>
      <template v-if="capStore.selectedCap.capReviewedBy">
        <p><strong>Reviewed by:</strong> {{ capStore.selectedCap.capReviewedBy }} on {{ formatDate(capStore.selectedCap.capReviewDate) || '-' }}</p>
        <p v-if="capStore.selectedCap.capReviewReason"><strong>Review reason:</strong> {{ capStore.selectedCap.capReviewReason }}</p>
      </template>

      <div v-if="capStore.selectedCap.rootCauseAnalysis" class="sub-section">
        <h4>Root Cause Analysis</h4>
        <p><strong>Method:</strong> {{ capStore.selectedCap.rootCauseAnalysis.method || '-' }}</p>
        <p v-if="capStore.selectedCap.rootCauseAnalysis.otherMethodDescription"><strong>Other method:</strong> {{ capStore.selectedCap.rootCauseAnalysis.otherMethodDescription }}</p>
        <p><strong>Main category:</strong> {{ capStore.selectedCap.rootCauseAnalysis.mainCategory || '-' }}</p>
        <p><strong>Root cause:</strong> {{ capStore.selectedCap.rootCauseAnalysis.rootCause || '-' }}</p>
        <p><strong>Contributing factors:</strong> {{ capStore.selectedCap.rootCauseAnalysis.contributingFactors || '-' }}</p>
        <div v-if="capStore.selectedCap.rootCauseAnalysis.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>Attachments</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.rootCauseAnalysis.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">View</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >Remove</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'rcaDetail')" />
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
        <div v-if="capStore.selectedCap.riskAssessment.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>Attachments</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.riskAssessment.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">View</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >Remove</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'riskDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!riskDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('risk-assessment')">Upload Risk Assessment Evidence</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.containmentMeasures" class="sub-section">
        <h4>Immediate Containment Measures</h4>
        <p><strong>Description:</strong> {{ capStore.selectedCap.containmentMeasures.description || '-' }}</p>
        <p><strong>Implemented:</strong> {{ formatDate(capStore.selectedCap.containmentMeasures.implementedDate) || '-' }}</p>
        <div v-if="capStore.selectedCap.containmentMeasures.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>Attachments</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.containmentMeasures.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">View</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >Remove</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'containmentDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!containmentDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('containment')">Upload Containment Evidence</BaseButton>
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
              <td>{{ formatDate(item.deadline) }}</td>
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
        <p><strong>Projected verification date:</strong> {{ formatDate(capStore.selectedCap.effectivenessVerification.projectedVerificationDate) || '-' }}</p>
      </div>

      <div v-if="reviewMode" class="sub-section review-section">
        <h4>Review this PAC</h4>
        <ul class="checklist">
          <li v-for="check in reviewChecklist" :key="check.label" :class="check.met ? 'checklist-met' : 'checklist-unmet'">
            <span class="checklist-icon">{{ check.met ? '✓' : '✗' }}</span> {{ check.label }}
          </li>
        </ul>
        <div class="form-grid">
          <div class="form-field">
            <label for="reviewDecision">Decision</label>
            <select id="reviewDecision" v-model="reviewDecision">
              <option value="Accepted">Accepted</option>
              <option value="Not Accepted">Not Accepted</option>
            </select>
          </div>
          <div class="form-field field-span-2">
            <label for="reviewReason">Reason{{ reviewDecision === 'Not Accepted' ? ' (required)' : ' (optional)' }}</label>
            <textarea id="reviewReason" v-model="reviewReason" rows="2" />
          </div>
        </div>
        <p v-if="reviewValidationError" class="error-message">{{ reviewValidationError }}</p>
        <div class="form-actions">
          <BaseButton variant="ghost" @click="cancelReview">Cancel</BaseButton>
          <BaseButton variant="primary" :disabled="capStore.loading" @click="confirmReview">Confirm Review</BaseButton>
        </div>
      </div>
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showSubmit }" @click="showSubmit = !showSubmit">Submit CAP</BaseButton>
    </div>

    <div v-if="showSubmit" class="card cap-submit-panel">
      <h3>{{ panelHeading }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="findingId">Finding ID</label>
          <input id="findingId" v-model="capForm.findingId" type="text" :disabled="editMode.type !== 'new'" />
        </div>
        <div class="form-field">
          <label for="dueDate">Due Date</label>
          <input id="dueDate" v-model="capForm.dueDate" type="date" />
        </div>
        <div class="form-field field-span-2">
          <p class="helper-text">CAP ID is auto-generated from the finding and existing CAP sequence. Action descriptions and responsible people are captured in the action-item rows below.</p>
        </div>
      </div>

      <div class="split-grid">
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
            <div class="form-field" v-if="editMode.type !== 'notAccepted'">
              <label for="rcaEvidence">Evidence of RCA</label>
              <input id="rcaEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'rca')" />
              <div v-if="rcaEvidenceFiles.length" class="evidence-list">
                <ul>
                  <li v-for="(file, index) in rcaEvidenceFiles" :key="`${file.name}-${index}`">
                    <span class="evidence-name">{{ file.name }}</span>
                    <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('rca', index)">Remove</BaseButton>
                  </li>
                </ul>
              </div>
            </div>
            <div class="form-field field-span-2" v-else>
              <p class="helper-text">Evidence can be attached from the CAP Detail view below.</p>
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
            <div class="form-field" v-if="editMode.type !== 'notAccepted'">
              <label for="raEvidence">Evidence</label>
              <input id="raEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'risk')" />
              <div v-if="riskEvidenceFiles.length" class="evidence-list">
                <ul>
                  <li v-for="(file, index) in riskEvidenceFiles" :key="`${file.name}-${index}`">
                    <span class="evidence-name">{{ file.name }}</span>
                    <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('risk', index)">Remove</BaseButton>
                  </li>
                </ul>
              </div>
            </div>
            <div class="form-field field-span-2" v-else>
              <p class="helper-text">Evidence can be attached from the CAP Detail view below.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">3. Immediate Containment Measures</h4>
        <div class="form-grid">
          <div class="form-field field-span-2">
            <label for="containmentDescription">Description</label>
            <textarea id="containmentDescription" v-model="capForm.containmentMeasures.description" rows="2" />
          </div>
          <div class="form-field">
            <label for="containmentImplementedDate">Implemented on</label>
            <input id="containmentImplementedDate" v-model="capForm.containmentMeasures.implementedDate" type="date" />
          </div>
          <div class="form-field" v-if="editMode.type !== 'notAccepted'">
            <label for="containmentEvidence">Evidence</label>
            <input id="containmentEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'containment')" />
            <div v-if="containmentEvidenceFiles.length" class="evidence-list">
              <ul>
                <li v-for="(file, index) in containmentEvidenceFiles" :key="`${file.name}-${index}`">
                  <span class="evidence-name">{{ file.name }}</span>
                  <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('containment', index)">Remove</BaseButton>
                </li>
              </ul>
            </div>
          </div>
          <div class="form-field field-span-2" v-else>
            <p class="helper-text">Evidence can be attached from the CAP Detail view below.</p>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">4. Corrective Actions</h4>
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

      <div class="split-grid">
        <div class="section-card">
          <h4 class="section-title">5. Expected Residual Risk</h4>
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
          <h4 class="section-title">6. Effectiveness Verification</h4>
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
      </div>

      <div class="form-actions" v-if="editMode.type === 'notAccepted'">
        <BaseButton variant="secondary" @click="saveNotAcceptedChangesAction" :disabled="capStore.loading">Save Changes</BaseButton>
        <BaseButton variant="primary" @click="resubmitNotAcceptedAction" :disabled="capStore.loading">Resubmit for Review</BaseButton>
      </div>
      <div class="form-actions" v-else>
        <BaseButton variant="secondary" @click="saveDraftAction" :disabled="capStore.loading">Save Draft</BaseButton>
        <BaseButton variant="primary" @click="submitForReviewAction" :disabled="capStore.loading">Submit for Review</BaseButton>
      </div>
    </div>

    <p v-if="capStore.error" class="error-message">{{ capStore.error }}</p>
    <p v-if="evidenceFileError" class="error-message">{{ evidenceFileError }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>

    <ModalWindow
      :show="showNoEvidenceConfirm"
      titulo="No evidence attached"
      explanation="No RCA or Risk Assessment evidence file is attached to this submission. Evidence can still be added later from the CAP Detail view, but the CAP will already be visible for review in the meantime."
      accion="submit this CAP without evidence"
      @confirm="confirmSubmitWithoutEvidence"
      @cancel="cancelSubmitWithoutEvidence"
    />

    <ModalWindow
      :show="Boolean(evidenceToRemove)"
      titulo="Remove evidence"
      :explanation="`This will permanently remove '${evidenceToRemove?.name || ''}' from this CAP.`"
      accion="remove this evidence file"
      @confirm="removeEvidenceConfirmed"
      @cancel="cancelRemoveEvidence"
    />
  </BaseManager>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import ModalWindow from '@/components/common/ModalWindow.vue';
import { useCapStore } from '@/stores/capStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';
import { apiCapEvidenceContentUrl } from '@/services/apiServices';
import { EVIDENCE_FILE_ACCEPT, validateEvidenceFile } from '@/utils/evidenceFile';

const route = useRoute();
const capStore = useCapStore();
const authStore = useAuthStore();

const message = ref('');
const evidenceFileError = ref('');
const showSubmit = ref(false);

// Editing a CAP has two entirely different mechanisms depending on where
// it is in its lifecycle: a Draft is a Postgres-only row (never an Alfresco
// node), while a Not Accepted CAP is a real, already-versioned Alfresco
// node being revised in place. { type: 'new' | 'draft' | 'notAccepted', id }
const editMode = ref({ type: 'new' });
const showNoEvidenceConfirm = ref(false);
const evidenceToRemove = ref(null);

function isCapEditableStatus(status) {
  return status === 'Not Accepted';
}

function isCapReviewable(status) {
  return status === 'Pending review';
}

const panelHeading = computed(() => {
  if (editMode.value.type === 'notAccepted') {
    return `Edit CAP: ${editMode.value.capId}`;
  }
  if (editMode.value.type === 'draft') {
    return 'Edit Draft CAP';
  }
  return 'Submit CAP';
});

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
  containmentMeasures: {
    description: '',
    implementedDate: '',
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

const rcaEvidenceFiles = ref([]);
const riskEvidenceFiles = ref([]);
const containmentEvidenceFiles = ref([]);
const rcaDetailEvidenceFile = ref(null);
const riskDetailEvidenceFile = ref(null);
const containmentDetailEvidenceFile = ref(null);

function onEvidenceFileChange(event, target) {
  evidenceFileError.value = '';
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
    evidenceFileError.value = rejectedMessages.join(' ');
  }

  if (target === 'rca') {
    rcaEvidenceFiles.value = [...rcaEvidenceFiles.value, ...accepted];
  } else if (target === 'risk') {
    riskEvidenceFiles.value = [...riskEvidenceFiles.value, ...accepted];
  } else if (target === 'containment') {
    containmentEvidenceFiles.value = [...containmentEvidenceFiles.value, ...accepted];
  } else if (target === 'rcaDetail') {
    rcaDetailEvidenceFile.value = accepted[0] || null;
  } else if (target === 'riskDetail') {
    riskDetailEvidenceFile.value = accepted[0] || null;
  } else if (target === 'containmentDetail') {
    containmentDetailEvidenceFile.value = accepted[0] || null;
  }
  // Clear the input so choosing the same file again still fires 'change'
  // (each selection is appended to the staged list above, not replaced).
  event.target.value = '';
}

function removeStagedEvidence(section, index) {
  if (section === 'rca') {
    rcaEvidenceFiles.value = rcaEvidenceFiles.value.filter((_, i) => i !== index);
  } else if (section === 'risk') {
    riskEvidenceFiles.value = riskEvidenceFiles.value.filter((_, i) => i !== index);
  } else if (section === 'containment') {
    containmentEvidenceFiles.value = containmentEvidenceFiles.value.filter((_, i) => i !== index);
  }
}

function hasSelectedEvidence() {
  return Boolean(rcaEvidenceFiles.value.length || riskEvidenceFiles.value.length || containmentEvidenceFiles.value.length);
}

async function uploadPendingEvidence(capId) {
  if (!capId) {
    return;
  }
  for (const file of rcaEvidenceFiles.value) {
    await capStore.uploadCapEvidence({ capId, section: 'rca', file, csrfToken: authStore.csrfToken });
  }
  for (const file of riskEvidenceFiles.value) {
    await capStore.uploadCapEvidence({ capId, section: 'risk-assessment', file, csrfToken: authStore.csrfToken });
  }
  for (const file of containmentEvidenceFiles.value) {
    await capStore.uploadCapEvidence({ capId, section: 'containment', file, csrfToken: authStore.csrfToken });
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

const reviewMode = ref(false);
const reviewDecision = ref('Accepted');
const reviewReason = ref('');
const reviewValidationError = ref('');

const reviewChecklist = computed(() => {
  const cap = capStore.selectedCap;
  if (!cap) {
    return [];
  }
  const rca = cap.rootCauseAnalysis;
  const risk = cap.riskAssessment;
  const containment = cap.containmentMeasures;
  const actions = cap.correctiveActions || [];
  const residual = cap.residualRisk;
  const effectiveness = cap.effectivenessVerification;
  const allEvidence = [
    ...(rca?.evidence || []),
    ...(risk?.evidence || []),
    ...(containment?.evidence || []),
  ];

  return [
    { label: 'Root Cause Analysis complete', met: Boolean(rca?.method && rca?.rootCause) },
    { label: 'Risk Assessment complete', met: Boolean(risk?.identifiedHazard && risk?.potentialConsequence && risk?.justification) },
    // Containment measures don't apply to every finding — absent entirely
    // is not a red flag, only present-but-incomplete is.
    { label: 'Immediate Containment Measures complete', met: !containment || Boolean(containment.description && containment.implementedDate) },
    { label: 'At least one Corrective Action defined', met: actions.length > 0 },
    { label: 'Every corrective action has a responsible person', met: actions.length > 0 && actions.every((item) => item.responsiblePerson) },
    { label: 'Every corrective action has a deadline', met: actions.length > 0 && actions.every((item) => item.deadline) },
    { label: 'Residual Risk complete', met: Boolean(residual?.justification) },
    { label: 'Effectiveness Verification complete', met: Boolean(effectiveness?.method && effectiveness?.indicators && effectiveness?.projectedVerificationDate) },
    { label: 'At least one evidence file attached', met: allEvidence.length > 0 },
  ];
});

const capScopePresets = [
  { value: 'all-caps', label: 'All CAPs' },
  { value: 'pending-caps', label: 'Pending review' },
  { value: 'accepted-caps', label: 'Accepted' },
  { value: 'not-accepted-caps', label: 'Not Accepted' },
];

const capAcceptanceStatuses = [
  'Pending review',
  'Accepted',
  'Not Accepted',
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
      resolved.acceptanceStatus = 'Pending review';
      break;
    case 'accepted-caps':
      resolved.acceptanceStatus = 'Accepted';
      break;
    case 'not-accepted-caps':
      resolved.acceptanceStatus = 'Not Accepted';
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

function resetForm() {
  capForm.findingId = '';
  capForm.dueDate = '';
  capForm.rootCauseAnalysis = { method: '5 Whys', otherMethodDescription: '', mainCategory: '', rootCause: '', contributingFactors: '' };
  capForm.riskAssessment = { hazard: '', consequence: '', probability: '', severity: '', calculatedRiskLevel: '', tolerabilityLevel: '', justification: '' };
  capForm.containmentMeasures = { description: '', implementedDate: '' };
  capForm.correctiveActions = [emptyCorrectiveAction()];
  capForm.residualRisk = { probability: '', severity: '', riskLevel: '', justification: '' };
  capForm.effectivenessVerification = { method: '', indicators: '', projectedVerificationDate: '' };
  rcaEvidenceFiles.value = [];
  riskEvidenceFiles.value = [];
  containmentEvidenceFiles.value = [];
  editMode.value = { type: 'new' };
}

function buildCapPayload() {
  // Containment measures don't apply to every finding — omitted entirely
  // (rather than sent as a hollow object) when the reviewer never filled
  // either field in.
  const hasContainmentMeasures = Boolean(capForm.containmentMeasures.description || capForm.containmentMeasures.implementedDate);

  return {
    dueDate: capForm.dueDate,
    rootCauseAnalysis: { ...capForm.rootCauseAnalysis },
    riskAssessment: { ...capForm.riskAssessment },
    ...(hasContainmentMeasures ? { containmentMeasures: { ...capForm.containmentMeasures } } : {}),
    correctiveActions: capForm.correctiveActions.map((item) => ({ ...item })),
    residualRisk: { ...capForm.residualRisk },
    effectivenessVerification: { ...capForm.effectivenessVerification },
  };
}

// "new"/"draft" modes: Save Draft persists to Postgres only, never Alfresco.
async function saveDraftAction() {
  message.value = '';
  try {
    const draft = await capStore.saveDraft({
      draftId: editMode.value.type === 'draft' ? editMode.value.draftId : null,
      findingId: capForm.findingId,
      payload: buildCapPayload(),
      csrfToken: authStore.csrfToken,
    });
    editMode.value = { type: 'draft', draftId: draft?.draftId };
    message.value = hasSelectedEvidence()
      ? 'Draft saved. Note: selected evidence file(s) are not saved with drafts — you will need to re-attach them when you submit for review.'
      : 'Draft saved.';
    await capStore.fetchDrafts();
  } catch (error) {
    console.error('Draft save failed:', error);
  }
}

// "new"/"draft" modes: Submit for Review creates the real Alfresco CAP.
// From "new" this is today's unchanged one-shot create. From "draft" the
// in-progress form is saved first so no edits are lost, then promoted.
// Evidence (if any) uploads immediately after, in the same action, so the
// CAP never sits reviewable-but-evidence-less for longer than necessary.
async function submitForReviewAction() {
  if (!hasSelectedEvidence()) {
    showNoEvidenceConfirm.value = true;
    return;
  }
  await performSubmitForReview();
}

async function confirmSubmitWithoutEvidence() {
  showNoEvidenceConfirm.value = false;
  await performSubmitForReview();
}

function cancelSubmitWithoutEvidence() {
  showNoEvidenceConfirm.value = false;
}

async function performSubmitForReview() {
  message.value = '';
  try {
    let capId;
    if (editMode.value.type === 'draft') {
      await capStore.saveDraft({
        draftId: editMode.value.draftId,
        payload: buildCapPayload(),
        csrfToken: authStore.csrfToken,
      });
      const { cap } = await capStore.submitDraft(editMode.value.draftId, authStore.csrfToken);
      capId = cap?.capId;
    } else {
      const { cap } = await capStore.submitCap({
        findingId: capForm.findingId,
        payload: buildCapPayload(),
        csrfToken: authStore.csrfToken,
      });
      capId = cap?.capId;
    }
    await uploadPendingEvidence(capId);

    message.value = 'CAP submitted successfully.';
    resetForm();
    await loadCaps();
    await capStore.fetchDrafts();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP submission failed:', error);
  }
}

// "notAccepted" mode: Save Changes edits an already-versioned Alfresco CAP
// in place (status stays Not Accepted) without resubmitting it for review.
async function saveNotAcceptedChangesAction() {
  message.value = '';
  try {
    await capStore.updateCap({
      capId: editMode.value.capId,
      payload: buildCapPayload(),
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP changes saved.';
    await viewCap(editMode.value.capId);
    await loadCaps();
  } catch (error) {
    console.error('CAP update failed:', error);
  }
}

// "notAccepted" mode: Resubmit for Review saves and flips status back to
// Pending review, same side effects as a fresh submission.
async function resubmitNotAcceptedAction() {
  message.value = '';
  try {
    await capStore.updateCap({
      capId: editMode.value.capId,
      payload: { ...buildCapPayload(), resubmit: true },
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP resubmitted for review.';
    resetForm();
    await loadCaps();
  } catch (error) {
    console.error('CAP resubmit failed:', error);
  }
}

async function editCap(cap) {
  message.value = '';
  await capStore.fetchCapDetail(cap.capId);
  const selected = capStore.selectedCap;
  if (!selected) {
    return;
  }
  capForm.findingId = selected.findingId || '';
  capForm.dueDate = selected.dueDate || '';
  capForm.rootCauseAnalysis = { method: '5 Whys', otherMethodDescription: '', mainCategory: '', rootCause: '', contributingFactors: '', ...selected.rootCauseAnalysis };
  capForm.riskAssessment = { hazard: '', consequence: '', probability: '', severity: '', calculatedRiskLevel: '', tolerabilityLevel: '', justification: '', ...selected.riskAssessment };
  capForm.containmentMeasures = { description: '', implementedDate: '', ...selected.containmentMeasures };
  capForm.correctiveActions = selected.correctiveActions?.length
    ? selected.correctiveActions.map((item) => ({ ...item }))
    : [emptyCorrectiveAction()];
  capForm.residualRisk = { probability: '', severity: '', riskLevel: '', justification: '', ...selected.residualRisk };
  capForm.effectivenessVerification = { method: '', indicators: '', projectedVerificationDate: '', ...selected.effectivenessVerification };
  editMode.value = { type: 'notAccepted', capId: cap.capId };
  showSubmit.value = true;
  reviewMode.value = false;
}

function editDraft(draft) {
  message.value = '';
  const payload = draft.payload || {};
  capForm.findingId = draft.findingId || '';
  capForm.dueDate = payload.dueDate || '';
  capForm.rootCauseAnalysis = { method: '5 Whys', otherMethodDescription: '', mainCategory: '', rootCause: '', contributingFactors: '', ...payload.rootCauseAnalysis };
  capForm.riskAssessment = { hazard: '', consequence: '', probability: '', severity: '', calculatedRiskLevel: '', tolerabilityLevel: '', justification: '', ...payload.riskAssessment };
  capForm.containmentMeasures = { description: '', implementedDate: '', ...payload.containmentMeasures };
  capForm.correctiveActions = payload.correctiveActions?.length
    ? payload.correctiveActions.map((item) => ({ ...item }))
    : [emptyCorrectiveAction()];
  capForm.residualRisk = { probability: '', severity: '', riskLevel: '', justification: '', ...payload.residualRisk };
  capForm.effectivenessVerification = { method: '', indicators: '', projectedVerificationDate: '', ...payload.effectivenessVerification };
  editMode.value = { type: 'draft', draftId: draft.draftId };
  showSubmit.value = true;
  reviewMode.value = false;
}

async function deleteDraftAction(draftId) {
  message.value = '';
  try {
    await capStore.deleteDraft(draftId, authStore.csrfToken);
    if (editMode.value.type === 'draft' && editMode.value.draftId === draftId) {
      resetForm();
    }
    message.value = 'Draft discarded.';
    await capStore.fetchDrafts();
  } catch (error) {
    console.error('Draft delete failed:', error);
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

function detailEvidenceFileRef(section) {
  if (section === 'rca') return rcaDetailEvidenceFile;
  if (section === 'containment') return containmentDetailEvidenceFile;
  return riskDetailEvidenceFile;
}

async function uploadDetailEvidence(section) {
  message.value = '';
  const fileRef = detailEvidenceFileRef(section);
  const file = fileRef.value;
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
    fileRef.value = null;
    await viewCap(capStore.selectedCap.capId);
  } catch (error) {
    console.error('Evidence upload failed:', error);
  }
}

function viewEvidence(item) {
  window.open(apiCapEvidenceContentUrl(capStore.selectedCap.capId, item.nodeId), '_blank', 'noopener');
}

function confirmRemoveEvidence(item) {
  evidenceToRemove.value = item;
}

function cancelRemoveEvidence() {
  evidenceToRemove.value = null;
}

async function removeEvidenceConfirmed() {
  const item = evidenceToRemove.value;
  if (!item) {
    return;
  }
  message.value = '';
  try {
    await capStore.deleteCapEvidence({
      capId: capStore.selectedCap.capId,
      evidenceNodeId: item.nodeId,
      csrfToken: authStore.csrfToken,
    });
    message.value = 'Evidence removed.';
    await viewCap(capStore.selectedCap.capId);
  } catch (error) {
    console.error('Evidence removal failed:', error);
  } finally {
    evidenceToRemove.value = null;
  }
}

async function startReview(capId) {
  message.value = '';
  reviewDecision.value = 'Accepted';
  reviewReason.value = '';
  reviewValidationError.value = '';
  reviewMode.value = true;
  await capStore.fetchCapDetail(capId);
}

function cancelReview() {
  reviewMode.value = false;
}

async function confirmReview() {
  message.value = '';
  reviewValidationError.value = '';
  const capId = capStore.selectedCap?.capId;
  if (!capId) {
    return;
  }
  if (reviewDecision.value === 'Not Accepted' && !reviewReason.value.trim()) {
    reviewValidationError.value = 'A reason is required when a CAP is marked Not Accepted.';
    return;
  }
  try {
    await capStore.reviewCap({
      capId,
      acceptanceStatus: reviewDecision.value,
      reason: reviewReason.value.trim(),
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP review applied.';
    reviewMode.value = false;
    await viewCap(capId);
    await loadCaps();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP review failed:', error);
  }
}

async function viewCap(capId) {
  reviewMode.value = false;
  await capStore.fetchCapDetail(capId);
}

function closeCapDetail() {
  reviewMode.value = false;
  capStore.clearSelectedCap();
}

onMounted(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    capForm.findingId = findingId;
  }
  await loadCaps();
  await capStore.fetchDrafts();
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

.review-section {
  background: var(--color-gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.checklist {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.checklist li {
  font-size: var(--text-sm);
}

.checklist-icon {
  display: inline-block;
  width: 1.2em;
}

.checklist-met {
  color: var(--color-success-700);
}

.checklist-unmet {
  color: var(--color-error-700);
}

.evidence-upload {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.evidence-list {
  margin-top: var(--space-2);
}

.evidence-list-title {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-primary-700);
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
  .split-grid {
    grid-template-columns: 1fr;
  }

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