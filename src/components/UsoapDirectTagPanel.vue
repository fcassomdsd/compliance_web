<template>
  <div class="usoap-tag-panel">
    <h4 class="section-title">{{ t('usoapTagPanel.title') }}</h4>
    <div class="form-grid">
      <div class="form-field">
        <label :for="`${uid}-ce`">{{ t('usoapTagPanel.criticalElement') }}</label>
        <select :id="`${uid}-ce`" v-model="form.criticalElement">
          <option value="">{{ t('usoapTagPanel.selectPlaceholder') }}</option>
          <option v-for="ce in CE_OPTIONS" :key="ce" :value="ce">{{ ce }}</option>
        </select>
      </div>
      <div class="form-field">
        <label :for="`${uid}-area`">{{ t('usoapTagPanel.areaCode') }}</label>
        <select :id="`${uid}-area`" v-model="form.areaCode">
          <option value="">{{ t('usoapTagPanel.selectPlaceholder') }}</option>
          <option v-for="area in AREA_OPTIONS" :key="area" :value="area">{{ area }}</option>
        </select>
      </div>
      <div class="form-field field-span-2">
        <label :for="`${uid}-pq`">{{ t('usoapTagPanel.pqReferences') }}</label>
        <select :id="`${uid}-pq`" v-model="form.pqReferences" multiple size="6">
          <option v-for="pq in candidatePqOptions" :key="pq.id" :value="pq.code">
            {{ pq.code }}{{ pq.texto ? ' — ' + pq.texto.slice(0, 80) : '' }}
          </option>
        </select>
        <p v-if="candidatePqOptions.length === 0" class="hint">{{ t('usoapTagPanel.noPqCandidates') }}</p>
      </div>
      <div class="form-field field-span-2">
        <label :for="`${uid}-basis`">{{ t('usoapTagPanel.evidenceBasis') }}</label>
        <select :id="`${uid}-basis`" v-model="form.evidenceBasis">
          <option value="">{{ t('usoapTagPanel.selectPlaceholder') }}</option>
          <option v-for="basis in EVIDENCE_BASIS_OPTIONS" :key="basis" :value="basis">{{ basis }}</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <BaseButton variant="primary" size="sm" :disabled="!canApply || usoapDirectTagStore.loading" @click="apply">
        {{ t('usoapTagPanel.applyTag') }}
      </BaseButton>
    </div>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    <p v-if="usoapDirectTagStore.error" class="error-message">{{ usoapDirectTagStore.error }}</p>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseButton from '@/components/base/BaseButton.vue';
import { useUsoapDirectTagStore } from '@/stores/usoapDirectTagStore';
import { useAuthStore } from '@/stores/authStore';

// Manual ("Direct") USOAP CE/area/PQ tagging for a whole-artifact node —
// a checklist, inspection, corrective action, follow-up report, or plain
// document — that the citation-chain import never tags automatically. See
// compliance_cmis/docs/usoap-evidence-structure.md, "Direct/manual tagging".
const props = defineProps({
  nodeId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['tagged']);

const { t } = useI18n();
const usoapDirectTagStore = useUsoapDirectTagStore();
const authStore = useAuthStore();

const uid = `usoap-tag-${Math.random().toString(36).slice(2, 8)}`;

// Mirrors vso:ceList / vso:usoapAreaList / vso:usoapEvidenceBasisList in
// compliance_cmis/configs/model/vsoModel.xml — keep in sync if those change.
const CE_OPTIONS = ['CE-1', 'CE-2', 'CE-3', 'CE-4', 'CE-5', 'CE-6', 'CE-7', 'CE-8'];
const AREA_OPTIONS = ['ATS', 'CNS', 'SAR', 'AIM', 'SMS', 'MET', 'AGA', 'P/OPS', 'CHT', 'PEL', 'OPS', 'AIR', 'FAL', 'AVSEC', 'DG', 'ENV', 'AIG'];
const EVIDENCE_BASIS_OPTIONS = ['Primary Legislation', 'Specific Regulation', 'Technical Guidance', 'Implementation Procedure', 'Oversight Record'];

const form = reactive({
  criticalElement: '',
  areaCode: '',
  pqReferences: [],
  evidenceBasis: '',
});

const successMessage = ref('');

const candidatePqOptions = computed(() =>
  usoapDirectTagStore.candidatePqs(form.criticalElement, form.areaCode)
);

const canApply = computed(() =>
  Boolean(form.criticalElement || form.areaCode || form.pqReferences.length)
);

async function apply() {
  successMessage.value = '';
  try {
    const result = await usoapDirectTagStore.applyDirectTag({
      tag: {
        nodeId: props.nodeId,
        criticalElement: form.criticalElement || undefined,
        areaCode: form.areaCode || undefined,
        ceMapping: form.criticalElement ? [form.criticalElement] : undefined,
        areaMapping: form.areaCode ? [form.areaCode] : undefined,
        pqReferences: form.pqReferences.length ? form.pqReferences : undefined,
        evidenceBasis: form.evidenceBasis || undefined,
      },
      csrfToken: authStore.csrfToken,
    });
    successMessage.value = t('usoapTagPanel.applied');
    emit('tagged', result);
  } catch (error) {
    console.error('Direct USOAP tag failed:', error);
  }
}

onMounted(async () => {
  try {
    await usoapDirectTagStore.ensureProtocolQuestionsLoaded();
  } catch (error) {
    console.error('Failed to load USOAP protocol question catalog:', error);
  }
});
</script>

<style scoped>
.usoap-tag-panel {
  margin-top: var(--space-4);
  border-top: 1px dashed var(--border-color);
  padding-top: var(--space-3);
}

.section-title {
  margin: 0 0 var(--space-3);
  color: var(--color-primary-700);
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

.form-grid select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-gray-900);
  box-sizing: border-box;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--space-2);
}

.hint {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-gray-500);
}

.error-message {
  color: var(--color-error-700);
}

.success-message {
  color: var(--color-success-700);
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
