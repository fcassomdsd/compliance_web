// Locale-aware subject/body catalog for internal role-inbox notifications
// (findings/CAP lifecycle events). Recipients are fixed distribution-list
// addresses per role (see roleNotify.cjs), not tied to a browsing session,
// so locale is resolved once per deployment via NOTIFICATION_LOCALE rather
// than per recipient.

function formatMessage(template, params = {}) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key
      .split('.')
      .reduce((acc, part) => (acc === null || acc === undefined ? acc : acc[part]), params);
    return value === null || value === undefined ? '' : String(value);
  });
}

const MESSAGES = {
  evidence_review_pending: {
    en: {
      subject: 'Follow-up evidence needs review: {{findingId}}',
      body: 'Follow-up {{followUpId}} was submitted for finding {{findingId}} and its evidence needs review.',
    },
    es: {
      subject: 'Evidencia de seguimiento requiere revisión: {{findingId}}',
      body: 'El seguimiento {{followUpId}} fue presentado para el hallazgo {{findingId}} y su evidencia requiere revisión.',
    },
  },
  closure_pending_approval: {
    en: {
      subject: 'Finding closure awaiting approval: {{findingId}}',
      body: "Finding {{findingId}} has effective closure evidence and is awaiting a reviewer's closure approval.",
    },
    es: {
      subject: 'Cierre de hallazgo en espera de aprobación: {{findingId}}',
      body: 'El hallazgo {{findingId}} cuenta con evidencia de cierre efectivo y está en espera de la aprobación de un revisor.',
    },
  },
  evidence_inadequate: {
    en: {
      subject: 'Follow-up evidence needs resubmission: {{findingId}}',
      body: 'Follow-up {{followUpId}} for finding {{findingId}} was marked inadequate{{notesSuffix}}',
    },
    es: {
      subject: 'Evidencia de seguimiento requiere reenvío: {{findingId}}',
      body: 'El seguimiento {{followUpId}} del hallazgo {{findingId}} fue marcado como inadecuado{{notesSuffix}}',
    },
  },
  finding_closed: {
    en: {
      subject: 'Finding closed: {{findingId}}',
      body: 'Finding {{findingId}} has been reviewed and formally closed.',
    },
    es: {
      subject: 'Hallazgo cerrado: {{findingId}}',
      body: 'El hallazgo {{findingId}} ha sido revisado y cerrado formalmente.',
    },
  },
  closure_rejected: {
    en: {
      subject: 'Finding closure rejected: {{findingId}}',
      body: "Finding {{findingId}}'s closure was rejected and requires further follow-up work.",
    },
    es: {
      subject: 'Cierre de hallazgo rechazado: {{findingId}}',
      body: 'El cierre del hallazgo {{findingId}} fue rechazado y requiere trabajo de seguimiento adicional.',
    },
  },
  deadline_extension_requested: {
    en: {
      subject: 'Deadline extension requested: {{findingId}}',
      body: 'A resolution-deadline extension to {{requestedResolutionDeadline}} was requested for finding {{findingId}}.',
    },
    es: {
      subject: 'Extensión de plazo solicitada: {{findingId}}',
      body: 'Se solicitó una extensión del plazo de resolución hasta {{requestedResolutionDeadline}} para el hallazgo {{findingId}}.',
    },
  },
  deadline_extension_reviewed: {
    en: {
      subject: 'Deadline extension {{decisionLabel}}: {{findingId}}',
      body: 'The requested resolution-deadline extension for finding {{findingId}} was {{decisionLabel}}.',
    },
    es: {
      subject: 'Extensión de plazo {{decisionLabel}}: {{findingId}}',
      body: 'La extensión del plazo de resolución solicitada para el hallazgo {{findingId}} fue {{decisionLabel}}.',
    },
  },
  cap_submitted: {
    en: {
      subject: 'CAP submitted for review: {{findingId}}',
      body: 'A corrective action plan ({{capId}}) was submitted for finding {{findingId}} and is awaiting review.',
    },
    es: {
      subject: 'Plan de acción correctiva presentado para revisión: {{findingId}}',
      body: 'Un plan de acción correctiva ({{capId}}) fue presentado para el hallazgo {{findingId}} y está en espera de revisión.',
    },
  },
  cap_resubmitted: {
    en: {
      subject: 'CAP resubmitted for review: {{capId}}',
      body: 'Corrective action plan {{capId}} was resubmitted after revision and is awaiting review.',
    },
    es: {
      subject: 'Plan de acción correctiva reenviado para revisión: {{capId}}',
      body: 'El plan de acción correctiva {{capId}} fue reenviado tras su revisión y está en espera de evaluación.',
    },
  },
  cap_reviewed: {
    en: {
      subject: 'CAP {{acceptanceStatusLabel}}: {{capId}}',
      body: 'Corrective action plan {{capId}} was {{acceptanceStatusLabel}} by a reviewer.',
    },
    es: {
      subject: 'Plan de acción correctiva {{acceptanceStatusLabel}}: {{capId}}',
      body: 'El plan de acción correctiva {{capId}} fue {{acceptanceStatusLabel}} por un revisor.',
    },
  },
};

function getNotificationLocale() {
  const configured = String(process.env.NOTIFICATION_LOCALE || 'es').trim().toLowerCase();
  return configured === 'es' ? 'es' : 'en';
}

function buildNotificationMessage(eventType, params = {}) {
  const entryByLocale = MESSAGES[eventType];
  if (!entryByLocale) {
    throw new Error(`No notification message defined for eventType "${eventType}"`);
  }

  const locale = getNotificationLocale();
  const entry = entryByLocale[locale] || entryByLocale.en;

  return {
    subject: formatMessage(entry.subject, params),
    body: formatMessage(entry.body, params),
  };
}

module.exports = {
  MESSAGES,
  formatMessage,
  getNotificationLocale,
  buildNotificationMessage,
};
