<template>
  <BaseManager :title="t('app.nav.correctiveActions')">
    <section class="card">
      <h3>{{ t('capManager.listing') }}</h3>
      <ScopePicker
        v-model="scope"
        mode="caps"
        :title="t('capManager.scope')"
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
            <th>{{ t('capManager.capId') }}</th>
            <th>{{ t('capManager.acceptanceStatus') }}</th>
            <th>{{ t('capManager.responsibleEntity') }}</th>
            <th>{{ t('capManager.dueDate') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cap in capStore.caps" :key="cap.capId">
            <td>{{ cap.capId }}</td>
            <td>{{ cap.acceptanceStatus }}</td>
            <td>{{ cap.responsibleEntity }}</td>
            <td>{{ formatDate(cap.dueDate) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="viewCap(cap.capId)">{{ t('common.view') }}</BaseButton>
              <BaseButton v-if="isCapEditableStatus(cap.acceptanceStatus)" variant="ghost" size="sm" @click="editCap(cap)">{{ t('common.edit') }}</BaseButton>
              <BaseButton v-if="isCapReviewable(cap.acceptanceStatus)" variant="ghost" size="sm" @click="startReview(cap.capId)">{{ t('findingManager.review') }}</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.drafts.length" class="card">
      <h3>{{ t('capManager.myDrafts') }}</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('findingManager.findingId') }}</th>
            <th>{{ t('capManager.lastSaved') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="draft in capStore.drafts" :key="draft.draftId">
            <td>{{ draft.findingId }}</td>
            <td>{{ formatDate(draft.updatedAt) || '-' }}</td>
            <td>
              <BaseButton variant="ghost" size="sm" @click="editDraft(draft)">{{ t('common.edit') }}</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="capStore.loading" @click="deleteDraftAction(draft.draftId)">{{ t('common.delete') }}</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.selectedCap" class="card detail-panel">
      <h3>{{ t('capManager.capDetail') }}: {{ capStore.selectedCap.capId }}</h3>
      <BaseButton v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" variant="ghost" size="sm" @click="editCap(capStore.selectedCap)">{{ t('common.edit') }}</BaseButton>
      <BaseButton v-if="isCapReviewable(capStore.selectedCap.acceptanceStatus) && !reviewMode" variant="ghost" size="sm" @click="startReview(capStore.selectedCap.capId)">{{ t('findingManager.review') }}</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="closeCapDetail">{{ t('common.close') }}</BaseButton>
      <p><strong>{{ t('capManager.acceptanceStatus') }}:</strong> {{ capStore.selectedCap.acceptanceStatus || '-' }}</p>
      <p><strong>{{ t('capManager.dueDate') }}:</strong> {{ formatDate(capStore.selectedCap.dueDate) || '-' }}</p>
      <p><strong>{{ t('capManager.actionItems') }}:</strong> {{ capStore.selectedCap.correctiveActions?.length || 0 }}</p>
      <p><strong>{{ t('capManager.followUpReports') }}:</strong> {{ capStore.selectedCap.followUpReports?.length || 0 }}</p>
      <template v-if="capStore.selectedCap.capReviewedBy">
        <p><strong>{{ t('followUpManager.reviewedBy') }}:</strong> {{ capStore.selectedCap.capReviewedBy }} {{ t('followUpManager.on') }} {{ formatDate(capStore.selectedCap.capReviewDate) || '-' }}</p>
        <p v-if="capStore.selectedCap.capReviewReason"><strong>{{ t('capManager.reviewReason') }}:</strong> {{ capStore.selectedCap.capReviewReason }}</p>
      </template>

      <div v-if="capStore.selectedCap.rootCauseAnalysis" class="sub-section">
        <h4>{{ t('capManager.rootCauseAnalysis') }}</h4>
        <p><strong>{{ t('capManager.method') }}:</strong> {{ capStore.selectedCap.rootCauseAnalysis.method || '-' }}</p>
        <p v-if="capStore.selectedCap.rootCauseAnalysis.otherMethodDescription"><strong>{{ t('capManager.otherMethod') }}:</strong> {{ capStore.selectedCap.rootCauseAnalysis.otherMethodDescription }}</p>
        <p><strong>{{ t('capManager.mainCategory') }}:</strong> {{ capStore.selectedCap.rootCauseAnalysis.mainCategory || '-' }}</p>
        <p><strong>{{ t('capManager.rootCause') }}:</strong> {{ capStore.selectedCap.rootCauseAnalysis.rootCause || '-' }}</p>
        <p><strong>{{ t('capManager.contributingFactors') }}:</strong> {{ capStore.selectedCap.rootCauseAnalysis.contributingFactors || '-' }}</p>
        <div v-if="capStore.selectedCap.rootCauseAnalysis.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>{{ t('followUpManager.attachments') }}</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.rootCauseAnalysis.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">{{ t('common.view') }}</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >{{ t('followUpManager.remove') }}</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'rcaDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!rcaDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('rca')">{{ t('capManager.uploadRcaEvidence') }}</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.riskAssessment" class="sub-section">
        <h4>{{ t('capManager.riskAssessment') }}</h4>
        <p><strong>{{ t('capManager.identifiedHazard') }}:</strong> {{ capStore.selectedCap.riskAssessment.identifiedHazard || '-' }}</p>
        <p><strong>{{ t('capManager.potentialConsequence') }}:</strong> {{ capStore.selectedCap.riskAssessment.potentialConsequence || '-' }}</p>
        <p><strong>{{ t('capManager.probability') }}:</strong> {{ capStore.selectedCap.riskAssessment.probability || '-' }}</p>
        <p><strong>{{ t('capManager.severity') }}:</strong> {{ capStore.selectedCap.riskAssessment.severity || '-' }}</p>
        <p><strong>{{ t('capManager.calculatedRiskLevel') }}:</strong> {{ capStore.selectedCap.riskAssessment.calculatedRiskLevel || '-' }}</p>
        <p><strong>{{ t('capManager.tolerabilityLevel') }}:</strong> {{ capStore.selectedCap.riskAssessment.tolerabilityLevel || '-' }}</p>
        <p><strong>{{ t('capManager.justification') }}:</strong> {{ capStore.selectedCap.riskAssessment.justification || '-' }}</p>
        <div v-if="capStore.selectedCap.riskAssessment.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>{{ t('followUpManager.attachments') }}</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.riskAssessment.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">{{ t('common.view') }}</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >{{ t('followUpManager.remove') }}</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'riskDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!riskDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('risk-assessment')">{{ t('capManager.uploadRiskEvidence') }}</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.containmentMeasures" class="sub-section">
        <h4>{{ t('capManager.containmentMeasures') }}</h4>
        <p><strong>{{ t('common.description') }}</strong> {{ capStore.selectedCap.containmentMeasures.description || '-' }}</p>
        <p><strong>{{ t('capManager.implemented') }}:</strong> {{ formatDate(capStore.selectedCap.containmentMeasures.implementedDate) || '-' }}</p>
        <div v-if="capStore.selectedCap.containmentMeasures.evidence?.length" class="evidence-list">
          <p class="evidence-list-title"><strong>{{ t('followUpManager.attachments') }}</strong></p>
          <ul>
            <li v-for="item in capStore.selectedCap.containmentMeasures.evidence" :key="item.nodeId">
              <span class="evidence-name">{{ item.name }}</span>
              <BaseButton variant="ghost" size="sm" @click="viewEvidence(item)">{{ t('common.view') }}</BaseButton>
              <BaseButton
                v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)"
                variant="ghost"
                size="sm"
                :disabled="capStore.loading"
                @click="confirmRemoveEvidence(item)"
              >{{ t('followUpManager.remove') }}</BaseButton>
            </li>
          </ul>
        </div>
        <div v-if="isCapEditableStatus(capStore.selectedCap.acceptanceStatus)" class="evidence-upload">
          <input type="file" :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'containmentDetail')" />
          <BaseButton variant="ghost" size="sm" :disabled="!containmentDetailEvidenceFile || capStore.loading" @click="uploadDetailEvidence('containment')">{{ t('capManager.uploadContainmentEvidence') }}</BaseButton>
        </div>
      </div>

      <div v-if="capStore.selectedCap.correctiveActions?.length" class="sub-section">
        <h4>{{ t('app.nav.correctiveActions') }}</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t('common.description') }}</th>
              <th>{{ t('capManager.priority') }}</th>
              <th>{{ t('capManager.responsible') }}</th>
              <th>{{ t('capManager.deadline') }}</th>
              <th>{{ t('common.status') }}</th>
              <th>{{ t('capManager.closureDate') }}</th>
              <th>{{ t('capManager.closureNotes') }}</th>
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
                  <option value="Open">{{ t('capManager.status.open') }}</option>
                  <option value="In Progress">{{ t('capManager.status.inProgress') }}</option>
                  <option value="Closed">{{ t('capManager.status.closed') }}</option>
                </select>
              </td>
              <td><input v-model="item.closureDate" type="date" :disabled="item.itemStatus !== 'Closed'" /></td>
              <td><input v-model="item.closureNotes" type="text" /></td>
              <td><BaseButton variant="ghost" size="sm" :disabled="capStore.loading" @click="updateActionItem(item)">{{ t('capManager.update') }}</BaseButton></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="capStore.selectedCap.residualRisk" class="sub-section">
        <h4>{{ t('capManager.expectedResidualRisk') }}</h4>
        <p><strong>{{ t('capManager.probability') }}:</strong> {{ capStore.selectedCap.residualRisk.probability || '-' }}</p>
        <p><strong>{{ t('capManager.severity') }}:</strong> {{ capStore.selectedCap.residualRisk.severity || '-' }}</p>
        <p><strong>{{ t('capManager.residualRiskLevel') }}:</strong> {{ capStore.selectedCap.residualRisk.riskLevel || '-' }}</p>
        <p><strong>{{ t('capManager.justification') }}:</strong> {{ capStore.selectedCap.residualRisk.justification || '-' }}</p>
      </div>

      <div v-if="capStore.selectedCap.effectivenessVerification" class="sub-section">
        <h4>{{ t('capManager.effectivenessVerification') }}</h4>
        <p><strong>{{ t('capManager.method') }}:</strong> {{ capStore.selectedCap.effectivenessVerification.method || '-' }}</p>
        <p><strong>{{ t('capManager.indicators') }}:</strong> {{ capStore.selectedCap.effectivenessVerification.indicators || '-' }}</p>
        <p><strong>{{ t('capManager.projectedVerificationDate') }}:</strong> {{ formatDate(capStore.selectedCap.effectivenessVerification.projectedVerificationDate) || '-' }}</p>
      </div>

      <div v-if="reviewMode" class="sub-section review-section">
        <h4>{{ t('capManager.reviewThisCap') }}</h4>
        <h5 class="evaluation-heading">{{ t('capManager.automatedChecks') }}</h5>
        <ul class="checklist">
          <li v-for="check in reviewChecklist" :key="check.label" :class="check.met ? 'checklist-met' : 'checklist-unmet'">
            <span class="checklist-icon">{{ check.met ? '✓' : '✗' }}</span> {{ check.label }}
          </li>
        </ul>

        <div class="manual-evaluation">
          <h5 class="evaluation-heading">{{ t('capManager.manualEvaluation') }}</h5>
          <div v-for="section in evaluationSections" :key="section.code" class="section-card">
            <h6 class="section-title">{{ section.title }}</h6>
            <div v-for="criterion in section.criteria" :key="criterion.code" class="evaluation-row">
              <template v-if="criterion.kind === 'binary'">
                <span class="evaluation-label">{{ criterion.label }}</span>
                <div class="evaluation-response-group" role="radiogroup" :aria-label="criterion.label">
                  <label v-for="option in criterionResponseOptions" :key="option">
                    <input
                      type="radio"
                      :name="`criterion-${criterion.code}`"
                      :value="option"
                      v-model="evaluationAnswers[criterion.code].response"
                    />
                    {{ option }}
                  </label>
                </div>
                <input
                  type="text"
                  class="evaluation-observations"
                  :placeholder="t('capManager.observations')"
                  :aria-label="`${criterion.label} observations`"
                  v-model="evaluationAnswers[criterion.code].observations"
                />
              </template>
              <template v-else>
                <label :for="`criterion-${criterion.code}`" class="evaluation-conclusion-label">{{ criterion.label }}</label>
                <textarea
                  :id="`criterion-${criterion.code}`"
                  class="evaluation-conclusion"
                  rows="2"
                  v-model="evaluationAnswers[criterion.code].observations"
                />
              </template>
            </div>
          </div>
          <p v-if="missingEvaluationCriteria.length" class="helper-text">
            {{ t('capManager.pendingCriteria', { count: missingEvaluationCriteria.length }) }}
          </p>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <label for="reviewDecision">{{ t('findingManager.decision') }}</label>
            <select id="reviewDecision" v-model="reviewDecision">
              <option value="Accepted">{{ t('findingManager.accepted') }}</option>
              <option value="Not Accepted">{{ t('capManager.notAccepted') }}</option>
            </select>
          </div>
          <div class="form-field field-span-2">
            <label for="reviewReason">{{ t('findingManager.reason') }}{{ reviewDecision === 'Not Accepted' ? t('capManager.required') : t('capManager.optional') }}</label>
            <textarea id="reviewReason" v-model="reviewReason" rows="2" />
          </div>
        </div>
        <p v-if="reviewValidationError" class="error-message">{{ reviewValidationError }}</p>
        <div class="form-actions">
          <BaseButton variant="ghost" @click="cancelReview">{{ t('common.cancel') }}</BaseButton>
          <BaseButton
            variant="primary"
            :disabled="capStore.loading || missingEvaluationCriteria.length > 0"
            @click="confirmReview"
          >
            {{ t('findingManager.confirmReview') }}
          </BaseButton>
        </div>
      </div>
    </section>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showSubmit }" @click="showSubmit = !showSubmit">{{ t('capManager.submitCap') }}</BaseButton>
    </div>

    <div v-if="showSubmit" class="card cap-submit-panel">
      <h3>{{ panelHeading }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="findingId">{{ t('findingManager.findingId') }}</label>
          <input id="findingId" v-model="capForm.findingId" type="text" :disabled="editMode.type !== 'new'" />
        </div>
        <div class="form-field">
          <label for="dueDate">{{ t('capManager.dueDate') }}</label>
          <input id="dueDate" v-model="capForm.dueDate" type="date" />
        </div>
        <div class="form-field field-span-2">
          <p class="helper-text">{{ t('capManager.capIdAutoGenerated') }}</p>
        </div>
      </div>

      <div class="split-grid">
        <div class="section-card">
          <h4 class="section-title">1. {{ t('capManager.rootCauseAnalysis') }}</h4>
          <div class="form-grid">
            <div class="form-field">
              <label for="rcaMethod">{{ t('capManager.methodUsed') }}</label>
              <select id="rcaMethod" v-model="capForm.rootCauseAnalysis.method">
                <option v-for="method in rcaMethods" :key="method" :value="method">{{ method }}</option>
              </select>
            </div>
            <div v-if="capForm.rootCauseAnalysis.method === 'Other'" class="form-field">
              <label for="rcaOtherMethodDescription">{{ t('capManager.otherMethodDescription') }}</label>
              <input id="rcaOtherMethodDescription" v-model="capForm.rootCauseAnalysis.otherMethodDescription" type="text" />
            </div>
            <div class="form-field">
              <label for="rcaMainCategory">{{ t('capManager.mainCategory') }}</label>
              <input id="rcaMainCategory" v-model="capForm.rootCauseAnalysis.mainCategory" type="text" />
            </div>
            <div class="form-field field-span-2">
              <label for="rootCause">{{ t('capManager.rootCause') }}</label>
              <textarea id="rootCause" v-model="capForm.rootCauseAnalysis.rootCause" rows="2" />
            </div>
            <div class="form-field field-span-2">
              <label for="contributingFactors">{{ t('capManager.contributingFactors') }}</label>
              <textarea id="contributingFactors" v-model="capForm.rootCauseAnalysis.contributingFactors" rows="2" />
            </div>
            <div class="form-field" v-if="editMode.type !== 'notAccepted'">
              <label for="rcaEvidence">{{ t('capManager.evidenceOfRca') }}</label>
              <input id="rcaEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'rca')" />
              <div v-if="rcaEvidenceFiles.length" class="evidence-list">
                <ul>
                  <li v-for="(file, index) in rcaEvidenceFiles" :key="`${file.name}-${index}`">
                    <span class="evidence-name">{{ file.name }}</span>
                    <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('rca', index)">{{ t('followUpManager.remove') }}</BaseButton>
                  </li>
                </ul>
              </div>
            </div>
            <div class="form-field field-span-2" v-else>
              <p class="helper-text">{{ t('capManager.evidenceFromDetailView') }}</p>
            </div>
          </div>
        </div>

        <div class="section-card">
          <h4 class="section-title">2. {{ t('capManager.riskAssessment') }}</h4>
          <div class="form-grid">
            <div class="form-field">
              <label for="raHazard">{{ t('capManager.identifiedHazard') }}</label>
              <input id="raHazard" v-model="capForm.riskAssessment.hazard" type="text" />
            </div>
            <div class="form-field">
              <label for="raConsequence">{{ t('capManager.potentialConsequence') }}</label>
              <input id="raConsequence" v-model="capForm.riskAssessment.consequence" type="text" />
            </div>
            <div class="form-field">
              <label for="raProbability">{{ t('capManager.probability') }}</label>
              <input id="raProbability" v-model="capForm.riskAssessment.probability" type="text" />
            </div>
            <div class="form-field">
              <label for="raSeverity">{{ t('capManager.severity') }}</label>
              <input id="raSeverity" v-model="capForm.riskAssessment.severity" type="text" />
            </div>
            <div class="form-field">
              <label for="raCalculatedRiskLevel">{{ t('capManager.calculatedRiskLevel') }}</label>
              <input id="raCalculatedRiskLevel" v-model="capForm.riskAssessment.calculatedRiskLevel" type="text" />
            </div>
            <div class="form-field">
              <label for="raTolerabilityLevel">{{ t('capManager.tolerabilityLevel') }}</label>
              <input id="raTolerabilityLevel" v-model="capForm.riskAssessment.tolerabilityLevel" type="text" />
            </div>
            <div class="form-field field-span-2">
              <label for="raJustification">{{ t('capManager.justification') }}</label>
              <textarea id="raJustification" v-model="capForm.riskAssessment.justification" rows="2" />
            </div>
            <div class="form-field" v-if="editMode.type !== 'notAccepted'">
              <label for="raEvidence">{{ t('capManager.evidence') }}</label>
              <input id="raEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'risk')" />
              <div v-if="riskEvidenceFiles.length" class="evidence-list">
                <ul>
                  <li v-for="(file, index) in riskEvidenceFiles" :key="`${file.name}-${index}`">
                    <span class="evidence-name">{{ file.name }}</span>
                    <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('risk', index)">{{ t('followUpManager.remove') }}</BaseButton>
                  </li>
                </ul>
              </div>
            </div>
            <div class="form-field field-span-2" v-else>
              <p class="helper-text">{{ t('capManager.evidenceFromDetailView') }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">3. {{ t('capManager.containmentMeasures') }}</h4>
        <div class="form-grid">
          <div class="form-field field-span-2">
            <label for="containmentDescription">{{ t('common.description') }}</label>
            <textarea id="containmentDescription" v-model="capForm.containmentMeasures.description" rows="2" />
          </div>
          <div class="form-field">
            <label for="containmentImplementedDate">{{ t('capManager.implementedOn') }}</label>
            <input id="containmentImplementedDate" v-model="capForm.containmentMeasures.implementedDate" type="date" />
          </div>
          <div class="form-field" v-if="editMode.type !== 'notAccepted'">
            <label for="containmentEvidence">{{ t('capManager.evidence') }}</label>
            <input id="containmentEvidence" type="file" multiple :accept="EVIDENCE_FILE_ACCEPT" @change="onEvidenceFileChange($event, 'containment')" />
            <div v-if="containmentEvidenceFiles.length" class="evidence-list">
              <ul>
                <li v-for="(file, index) in containmentEvidenceFiles" :key="`${file.name}-${index}`">
                  <span class="evidence-name">{{ file.name }}</span>
                  <BaseButton variant="ghost" size="sm" @click="removeStagedEvidence('containment', index)">{{ t('followUpManager.remove') }}</BaseButton>
                </li>
              </ul>
            </div>
          </div>
          <div class="form-field field-span-2" v-else>
            <p class="helper-text">{{ t('capManager.evidenceFromDetailView') }}</p>
          </div>
        </div>
      </div>

      <div class="section-card">
        <h4 class="section-title">4. {{ t('app.nav.correctiveActions') }}</h4>
        <div class="action-item-head" aria-hidden="true">
          <span>#</span>
          <span>{{ t('common.description') }}</span>
          <span>{{ t('capManager.priority') }}</span>
          <span>{{ t('capManager.responsible') }}</span>
          <span>{{ t('capManager.deadline') }}</span>
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
            <BaseButton variant="ghost" size="sm" :disabled="capForm.correctiveActions.length <= 1" @click="removeCorrectiveAction(index)">{{ t('followUpManager.remove') }}</BaseButton>
          </div>
        </div>
        <div class="form-actions">
          <BaseButton variant="ghost" size="sm" @click="addCorrectiveAction">{{ t('capManager.addCorrectiveAction') }}</BaseButton>
        </div>
      </div>

      <div class="split-grid">
        <div class="section-card">
          <h4 class="section-title">5. {{ t('capManager.expectedResidualRisk') }}</h4>
          <div class="form-grid">
            <div class="form-field">
              <label for="residualProbability">{{ t('capManager.probability') }}</label>
              <input id="residualProbability" v-model="capForm.residualRisk.probability" type="text" />
            </div>
            <div class="form-field">
              <label for="residualSeverity">{{ t('capManager.severity') }}</label>
              <input id="residualSeverity" v-model="capForm.residualRisk.severity" type="text" />
            </div>
            <div class="form-field field-span-2">
              <label for="residualRiskLevel">{{ t('capManager.residualRiskLevel') }}</label>
              <input id="residualRiskLevel" v-model="capForm.residualRisk.riskLevel" type="text" />
            </div>
            <div class="form-field field-span-2">
              <label for="residualJustification">{{ t('capManager.justification') }}</label>
              <textarea id="residualJustification" v-model="capForm.residualRisk.justification" rows="2" />
            </div>
          </div>
        </div>

        <div class="section-card">
          <h4 class="section-title">6. {{ t('capManager.effectivenessVerification') }}</h4>
          <div class="form-grid">
            <div class="form-field">
              <label for="verificationMethod">{{ t('capManager.method') }}</label>
              <input id="verificationMethod" v-model="capForm.effectivenessVerification.method" type="text" />
            </div>
            <div class="form-field">
              <label for="verificationIndicators">{{ t('capManager.indicatorsLabel') }}</label>
              <textarea id="verificationIndicators" v-model="capForm.effectivenessVerification.indicators" rows="2" />
            </div>
            <div class="form-field">
              <label for="projectedVerificationDate">{{ t('capManager.projectedDateOfVerification') }}</label>
              <input id="projectedVerificationDate" v-model="capForm.effectivenessVerification.projectedVerificationDate" type="date" />
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions" v-if="editMode.type === 'notAccepted'">
        <BaseButton variant="secondary" @click="saveNotAcceptedChangesAction" :disabled="capStore.loading">{{ t('capManager.saveChanges') }}</BaseButton>
        <BaseButton variant="primary" @click="resubmitNotAcceptedAction" :disabled="capStore.loading">{{ t('capManager.resubmitForReview') }}</BaseButton>
      </div>
      <div class="form-actions" v-else>
        <BaseButton variant="secondary" @click="saveDraftAction" :disabled="capStore.loading">{{ t('capManager.saveDraft') }}</BaseButton>
        <BaseButton variant="primary" @click="submitForReviewAction" :disabled="capStore.loading">{{ t('capManager.submitForReview') }}</BaseButton>
      </div>
    </div>

    <p v-if="capStore.error" class="error-message">{{ capStore.error }}</p>
    <p v-if="evidenceFileError" class="error-message">{{ evidenceFileError }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>

    <ModalWindow
      :show="showNoEvidenceConfirm"
      :titulo="t('capManager.noEvidenceTitle')"
      :explanation="t('capManager.noEvidenceExplanation')"
      :accion="t('capManager.noEvidenceAction')"
      @confirm="confirmSubmitWithoutEvidence"
      @cancel="cancelSubmitWithoutEvidence"
    />

    <ModalWindow
      :show="Boolean(evidenceToRemove)"
      :titulo="t('capManager.removeEvidenceTitle')"
      :explanation="t('capManager.removeEvidenceExplanation', { name: evidenceToRemove?.name || '' })"
      :accion="t('capManager.removeEvidenceAction')"
      @confirm="removeEvidenceConfirmed"
      @cancel="cancelRemoveEvidence"
    />
  </BaseManager>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
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
import { CAP_EVALUATION_CRITERIA, CAP_EVALUATION_SECTIONS, getMissingCapEvaluationCriteria } from '@/utils/capEvaluationCriteria';

const { t } = useI18n();
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
    return t('capManager.editCap', { capId: editMode.value.capId });
  }
  if (editMode.value.type === 'draft') {
    return t('capManager.editDraftCap');
  }
  return t('capManager.submitCap');
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

const criterionResponseOptions = ['Sí', 'No', 'No aplica'];
const evaluationAnswers = reactive({});

function resetEvaluationAnswers() {
  for (const key of Object.keys(evaluationAnswers)) {
    delete evaluationAnswers[key];
  }
  for (const entry of CAP_EVALUATION_CRITERIA) {
    evaluationAnswers[entry.code] = { response: '', observations: '' };
  }
}

function loadEvaluationAnswers(criteria = []) {
  resetEvaluationAnswers();
  for (const row of criteria) {
    if (evaluationAnswers[row.criterionCode]) {
      evaluationAnswers[row.criterionCode] = {
        response: row.criterionResponse || '',
        observations: row.criterionObservations || '',
      };
    }
  }
}

// Populated eagerly (not just inside startReview) so the review panel never
// renders with undefined entries during the async window between
// reviewMode turning true and fetchCapDetail/loadEvaluationAnswers
// resolving.
resetEvaluationAnswers();

// Containment measures don't apply to every finding — same "not every CAP
// has this section" rule already applied to the automatic checklist above
// and to validateContainmentMeasures on the server, so its 3 criteria +
// conclusion are hidden and excluded from the completeness gate when the
// CAP has no containment measures.
const hasContainmentSection = computed(() => Boolean(capStore.selectedCap?.containmentMeasures));

const evaluationSections = computed(() =>
  CAP_EVALUATION_SECTIONS.filter((section) => section.code !== 'CONTAINMENT' || hasContainmentSection.value).map((section) => ({
    ...section,
    criteria: CAP_EVALUATION_CRITERIA.filter((entry) => entry.section === section.code),
  }))
);

const missingEvaluationCriteria = computed(() => {
  const savedShape = Object.entries(evaluationAnswers).map(([code, value]) => ({
    criterionCode: code,
    criterionResponse: value.response,
  }));
  return getMissingCapEvaluationCriteria(savedShape, { hasContainment: hasContainmentSection.value });
});

// Persists the manual evaluation. Only ever called from confirmReview,
// immediately before applying the decision — there is no standalone "Save"
// action, so an evaluation is never persisted without a decision following
// it (avoids leaving a saved-but-undecided evaluation behind if the
// reviewer then hits Cancel). Errors intentionally propagate: confirmReview
// must not proceed to reviewCap if the save failed.
async function saveEvaluation() {
  const capId = capStore.selectedCap?.capId;
  if (!capId) {
    return;
  }
  const criteria = CAP_EVALUATION_CRITERIA.filter((entry) => entry.section !== 'CONTAINMENT' || hasContainmentSection.value).map(
    (entry) => ({
      code: entry.code,
      response: evaluationAnswers[entry.code]?.response || '',
      observations: evaluationAnswers[entry.code]?.observations || '',
    })
  );
  await capStore.saveCapEvaluation({ capId, criteria, csrfToken: authStore.csrfToken });
}

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
    { label: t('capManager.checklist.rca'), met: Boolean(rca?.method && rca?.rootCause) },
    { label: t('capManager.checklist.risk'), met: Boolean(risk?.identifiedHazard && risk?.potentialConsequence && risk?.justification) },
    // Containment measures don't apply to every finding — absent entirely
    // is not a red flag, only present-but-incomplete is.
    { label: t('capManager.checklist.containment'), met: !containment || Boolean(containment.description && containment.implementedDate) },
    { label: t('capManager.checklist.actionsDefined'), met: actions.length > 0 },
    { label: t('capManager.checklist.actionsResponsible'), met: actions.length > 0 && actions.every((item) => item.responsiblePerson) },
    { label: t('capManager.checklist.actionsDeadline'), met: actions.length > 0 && actions.every((item) => item.deadline) },
    { label: t('capManager.checklist.residual'), met: Boolean(residual?.justification) },
    { label: t('capManager.checklist.effectiveness'), met: Boolean(effectiveness?.method && effectiveness?.indicators && effectiveness?.projectedVerificationDate) },
    { label: t('capManager.checklist.evidence'), met: allEvidence.length > 0 },
  ];
});

const capScopePresets = [
  { value: 'all-caps', label: t('capManager.presets.all') },
  { value: 'pending-caps', label: t('capManager.presets.pending') },
  { value: 'accepted-caps', label: t('capManager.presets.accepted') },
  { value: 'not-accepted-caps', label: t('capManager.presets.notAccepted') },
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
      ? t('capManager.toast.draftSavedWithEvidenceNote')
      : t('capManager.toast.draftSaved');
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

    message.value = t('capManager.toast.submitted');
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
    message.value = t('capManager.toast.changesSaved');
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
    message.value = t('capManager.toast.resubmitted');
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
    message.value = t('capManager.toast.draftDiscarded');
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
    message.value = t('capManager.toast.actionUpdated', { sequenceNumber: item.sequenceNumber });
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
    message.value = t('capManager.toast.evidenceUploaded');
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
    message.value = t('capManager.toast.evidenceRemoved');
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
  loadEvaluationAnswers(capStore.selectedCap?.currentEvaluation?.criteria || []);
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
  if (missingEvaluationCriteria.value.length > 0) {
    reviewValidationError.value = t('capManager.toast.evaluationIncomplete', { count: missingEvaluationCriteria.value.length });
    return;
  }
  if (reviewDecision.value === 'Not Accepted' && !reviewReason.value.trim()) {
    reviewValidationError.value = t('capManager.toast.reasonRequired');
    return;
  }
  try {
    // Persist whatever's currently in the manual evaluation form before
    // applying the decision — the server independently re-validates
    // completeness (409 CAP_EVALUATION_INCOMPLETE) as the authoritative
    // backstop, but saving here keeps the two in sync for the common path.
    await saveEvaluation();
    await capStore.reviewCap({
      capId,
      acceptanceStatus: reviewDecision.value,
      reason: reviewReason.value.trim(),
      csrfToken: authStore.csrfToken,
    });
    message.value = t('capManager.toast.reviewApplied');
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

.evaluation-heading {
  margin: 0 0 var(--space-2);
  color: var(--color-primary-700);
}

.manual-evaluation {
  margin-top: var(--space-4);
}

.evaluation-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1.4fr);
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) 0;
  border-top: 1px dashed var(--border-color);
}

.evaluation-row:first-of-type {
  border-top: none;
}

.evaluation-label,
.evaluation-conclusion-label {
  font-size: var(--text-sm);
  color: var(--color-gray-900);
}

.evaluation-conclusion-label {
  font-weight: 600;
  color: var(--color-primary-700);
}

.evaluation-conclusion {
  grid-column: 1 / -1;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  resize: vertical;
  box-sizing: border-box;
}

.evaluation-response-group {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  font-size: var(--text-sm);
}

.evaluation-response-group label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 400;
}

.evaluation-observations {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-sm);
  box-sizing: border-box;
}

@media (max-width: 768px) {
  .evaluation-row {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
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