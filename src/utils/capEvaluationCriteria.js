// Client-side mirror of server/domain/capEvaluationCriteria.cjs — the
// IDAC-PAC-EVAL-01 "Evaluación del Plan de Acción Correctiva" checklist
// criteria. Vite cannot cleanly import that CJS module from src/ (same
// constraint documented in documentCodes.js), so the catalog is duplicated
// here. Keep the two in lockstep if the catalog ever changes.
export const CAP_EVALUATION_CRITERIA = [
  // Section 2 — Verificación Administrativa
  { code: 'ADMIN.WITHIN_DEADLINE', section: 'ADMIN', kind: 'binary', label: 'PAC presentado dentro del plazo establecido' },
  { code: 'ADMIN.AUTHORIZED_SIGNATURE', section: 'ADMIN', kind: 'binary', label: 'PAC firmado por representante autorizado' },
  { code: 'ADMIN.FINDING_IDENTIFIED', section: 'ADMIN', kind: 'binary', label: 'Se identifica el Hallazgo correspondiente' },
  { code: 'ADMIN.EVIDENCE_ATTACHED', section: 'ADMIN', kind: 'binary', label: 'Se adjuntan las evidencias declaradas' },
  { code: 'ADMIN.MINIMUM_ELEMENTS', section: 'ADMIN', kind: 'binary', label: 'El PAC incluye todos los elementos mínimos requeridos (IDAC-NC-01 §7)' },

  // 3.1 Análisis de Causa Raíz
  { code: 'RCA.RECOGNIZED_METHOD', section: 'RCA', kind: 'binary', label: 'Se utilizó una metodología reconocida' },
  { code: 'RCA.ROOT_CAUSE_CLEAR', section: 'RCA', kind: 'binary', label: 'La causa raíz está claramente identificada' },
  { code: 'RCA.ROOT_CAUSE_EXPLAINS', section: 'RCA', kind: 'binary', label: 'La causa raíz explica razonablemente el Hallazgo' },
  { code: 'RCA.CONTRIBUTING_FACTORS', section: 'RCA', kind: 'binary', label: 'Se identificaron factores contribuyentes relevantes' },
  { code: 'RCA.CONCLUSION', section: 'RCA', kind: 'conclusion', label: 'Conclusión del Inspector' },

  // 3.2 Evaluación del Riesgo (SMS del operador)
  { code: 'RISK.HAZARD_IDENTIFIED', section: 'RISK', kind: 'binary', label: 'Se identificó adecuadamente el peligro' },
  { code: 'RISK.CONSEQUENCE_COHERENT', section: 'RISK', kind: 'binary', label: 'La consecuencia potencial es coherente' },
  { code: 'RISK.METHODOLOGY_ADEQUATE', section: 'RISK', kind: 'binary', label: 'La metodología de evaluación es adecuada' },
  { code: 'RISK.JUSTIFICATION_SUFFICIENT', section: 'RISK', kind: 'binary', label: 'La evaluación del riesgo está suficientemente justificada' },
  { code: 'RISK.CONCLUSION', section: 'RISK', kind: 'conclusion', label: 'Conclusión del Inspector' },

  // 3.3 Medidas de Contención — skippable when the CAP has no containment
  // measures section.
  { code: 'CONTAINMENT.REDUCES_RISK_IMMEDIATELY', section: 'CONTAINMENT', kind: 'binary', label: 'Reducen el riesgo de forma inmediata' },
  { code: 'CONTAINMENT.TECHNICALLY_VIABLE', section: 'CONTAINMENT', kind: 'binary', label: 'Son técnicamente viables' },
  { code: 'CONTAINMENT.IMPLEMENTED_TIMELY', section: 'CONTAINMENT', kind: 'binary', label: 'Fueron implementadas oportunamente' },
  { code: 'CONTAINMENT.CONCLUSION', section: 'CONTAINMENT', kind: 'conclusion', label: 'Conclusión del Inspector' },

  // 3.4 Acciones Correctivas
  { code: 'ACTIONS.ELIMINATES_ROOT_CAUSE', section: 'ACTIONS', kind: 'binary', label: 'Eliminan la causa raíz identificada' },
  { code: 'ACTIONS.PROPORTIONAL_TO_RISK', section: 'ACTIONS', kind: 'binary', label: 'Son proporcionales al riesgo' },
  { code: 'ACTIONS.RESPONSIBLE_ASSIGNED', section: 'ACTIONS', kind: 'binary', label: 'Se asignaron responsables' },
  { code: 'ACTIONS.SCHEDULE_REASONABLE', section: 'ACTIONS', kind: 'binary', label: 'El cronograma es razonable' },
  { code: 'ACTIONS.CONCLUSION', section: 'ACTIONS', kind: 'conclusion', label: 'Conclusión del Inspector' },

  // 3.5 Riesgo Residual Esperado
  { code: 'RESIDUAL.EVALUATED', section: 'RESIDUAL', kind: 'binary', label: 'El riesgo residual fue evaluado' },
  { code: 'RESIDUAL.JUSTIFICATION_SUFFICIENT', section: 'RESIDUAL', kind: 'binary', label: 'La justificación es suficiente' },
  { code: 'RESIDUAL.ACCEPTABILITY_SUBSTANTIATED', section: 'RESIDUAL', kind: 'binary', label: 'La aceptabilidad del riesgo está debidamente sustentada' },
  { code: 'RESIDUAL.CONCLUSION', section: 'RESIDUAL', kind: 'conclusion', label: 'Conclusión del Inspector' },

  // 3.6 Verificación de Eficacia propuesta
  { code: 'EFFECTIVENESS.METHOD_DEFINED', section: 'EFFECTIVENESS', kind: 'binary', label: 'Se definió un método de verificación' },
  { code: 'EFFECTIVENESS.INDICATORS_ADEQUATE', section: 'EFFECTIVENESS', kind: 'binary', label: 'Se establecieron indicadores adecuados' },
  { code: 'EFFECTIVENESS.DATE_DEFINED', section: 'EFFECTIVENESS', kind: 'binary', label: 'Se definió una fecha para verificar la eficacia' },
  { code: 'EFFECTIVENESS.CONCLUSION', section: 'EFFECTIVENESS', kind: 'conclusion', label: 'Conclusión del Inspector' },
];

export const CAP_EVALUATION_SECTIONS = [
  { code: 'ADMIN', title: 'Verificación Administrativa' },
  { code: 'RCA', title: '3.1 Análisis de Causa Raíz' },
  { code: 'RISK', title: '3.2 Evaluación del Riesgo (SMS del operador)' },
  { code: 'CONTAINMENT', title: '3.3 Medidas de Contención' },
  { code: 'ACTIONS', title: '3.4 Acciones Correctivas' },
  { code: 'RESIDUAL', title: '3.5 Riesgo Residual Esperado' },
  { code: 'EFFECTIVENESS', title: '3.6 Verificación de Eficacia propuesta' },
];

// Shared completeness rule — must match server/domain/statusRules.cjs's
// isCapEvaluationComplete exactly, since the client-side check here is only
// a UX nicety; the server's copy is the authoritative gate.
export function getMissingCapEvaluationCriteria(savedCriteria = [], { hasContainment = true } = {}) {
  const responseByCode = new Map(savedCriteria.map((row) => [row.criterionCode, row.criterionResponse]));
  const validResponses = new Set(['Sí', 'No', 'No aplica']);
  return CAP_EVALUATION_CRITERIA.filter((entry) => entry.kind === 'binary')
    .filter((entry) => hasContainment || entry.section !== 'CONTAINMENT')
    .filter((entry) => !validResponses.has(responseByCode.get(entry.code)))
    .map((entry) => entry.code);
}
