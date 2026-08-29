const { mapFindingNode, mapFollowUpReportNode, getFollowUpReportsForFinding } = require('../domain/alfrescoMappers.cjs');
const { computeEffectiveFindingStatus, FINDING_STATUS } = require('../domain/statusRules.cjs');
const { notifyRoleInbox } = require('../notifications/roleNotify.cjs');

function untilNextRunMs(hourLocal = 1, now = new Date()) {
  const next = new Date(now);
  next.setHours(hourLocal, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function nowIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

async function getFollowUpReportsForFindingAndCaps({ alfrescoClient, ticket, findingNodeId }) {
  const all = await getFollowUpReportsForFinding({ alfrescoClient, ticket, findingNodeId });

  const capNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: findingNodeId,
    nodeType: 'vso:correctiveAction',
  });

  for (const capNode of capNodes) {
    const followUps = await alfrescoClient.listChildrenByType({
      ticket,
      parentNodeId: capNode.id,
      nodeType: 'vso:followUpReport',
    });
    all.push(...followUps.map(mapFollowUpReportNode));
  }

  return all;
}

// Per the BPMN's "Plazo vencido" escalation path: any deadline miss (CAP
// submission or finding resolution) routes to "Solución de Casos de
// Seguridad". Recipient is a fixed distribution list, not resolved
// per-user, since no email addresses exist anywhere in this data model.
async function escalateNewlyOverdueFinding({ finding, effectiveStatus, notificationService, now }) {
  const deadlineKind = effectiveStatus === FINDING_STATUS.CAP_OVERDUE ? 'CAP submission' : 'finding resolution';
  await notifyRoleInbox({
    notificationService,
    envVar: 'CASE_ESCALATION_EMAIL',
    eventType: 'case_escalation',
    subject: `Case escalation required: ${finding.findingId} (${deadlineKind} deadline missed)`,
    body: [
      `Finding ${finding.findingId} has missed its ${deadlineKind} deadline and requires case escalation.`,
      `Provider: ${finding.providerName || finding.providerId || 'unknown'}`,
      `Location: ${finding.locationName || finding.locationCode || 'unknown'}`,
      `Status: ${effectiveStatus}`,
      `Detected: ${now().toISOString()}`,
    ].join('\n'),
    context: { findingId: finding.findingId, effectiveStatus },
    isCritical: true,
  });
}

// Daily digest, appended to the same sweep, of findings still awaiting
// post-upload review (see PATCH /findings/:findingId/review). There's no
// Express endpoint call to hook a trigger into here — findings land in
// "Pending Review" via the canonical-import webscript in compliance_cmis,
// which this service doesn't observe synchronously — so this polls
// instead, same as overdue detection itself.
async function sendPendingReviewDigest({ pendingReviewFindings, notificationService }) {
  if (pendingReviewFindings.length === 0) {
    return;
  }
  await notifyRoleInbox({
    notificationService,
    envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
    eventType: 'finding_review_pending',
    subject: `${pendingReviewFindings.length} finding(s) awaiting review`,
    body: [
      'The following findings are awaiting reviewer confirmation before a CAP can be submitted against them:',
      ...pendingReviewFindings.map((f) => `- ${f.findingId} (${f.providerName || f.providerId || 'unknown provider'})`),
    ].join('\n'),
    context: { findingIds: pendingReviewFindings.map((f) => f.findingId) },
  });
}

async function runFindingOverdueSync({ alfrescoClient, username, password, notificationService, logger = console, now = () => new Date() }) {
  if (!username || !password) {
    logger.warn('Finding overdue job skipped: ALFRESCO_JOB_USERNAME/ALFRESCO_JOB_PASSWORD not configured');
    return { skipped: true, updated: 0, drift: 0 };
  }

  const auth = await alfrescoClient.createTicket(username, password);
  const ticket = auth.ticket;

  try {
    const findings = await alfrescoClient.searchNodes({
      ticket,
      query: "TYPE:'vso:finding' AND PATH:'/app:company_home/st:sites/cm:vigilancia-de-la-so/cm:documentLibrary/cm:Vigilancia/cm:Hallazgos//*'",
      maxItems: 2000,
    });

    let updated = 0;
    let drift = 0;
    const pendingReviewFindings = [];

    for (const findingNode of findings) {
      const finding = mapFindingNode(findingNode);

      if (finding.findingReviewStatus === 'Pending Review') {
        pendingReviewFindings.push(finding);
      }

      const followUps = await getFollowUpReportsForFindingAndCaps({
        alfrescoClient,
        ticket,
        findingNodeId: findingNode.id,
      });

      const status = computeEffectiveFindingStatus({
        finding,
        followUpReports: followUps,
        now: now(),
      });

      if (status.statusDivergence) {
        drift += 1;
      }

      const isNewlyOverdue =
        (status.effectiveStatus === FINDING_STATUS.SOLUTION_OVERDUE || status.effectiveStatus === FINDING_STATUS.CAP_OVERDUE) &&
        status.storedStatus !== status.effectiveStatus;

      if (isNewlyOverdue) {
        await escalateNewlyOverdueFinding({
          finding,
          effectiveStatus: status.effectiveStatus,
          notificationService,
          now,
        });

        await alfrescoClient.updateNodeProperties({
          ticket,
          nodeId: finding.nodeId,
          properties: {
            'vso:findingStatus': status.effectiveStatus,
            'vso:lastStatusChange': nowIsoDate(now()),
          },
        });
        updated += 1;
      }
    }

    await sendPendingReviewDigest({ pendingReviewFindings, notificationService });

    logger.info('Finding overdue sync completed', { updated, drift, pendingReview: pendingReviewFindings.length, total: findings.length });
    return { skipped: false, updated, drift, pendingReview: pendingReviewFindings.length };
  } finally {
    await alfrescoClient.revokeTicket(ticket).catch(() => undefined);
  }
}

function startFindingOverdueJob({
  alfrescoClient,
  username,
  password,
  notificationService,
  logger = console,
  now = () => new Date(),
  runHourLocal = 1,
}) {
  let timeoutId = null;

  const schedule = () => {
    const waitMs = untilNextRunMs(runHourLocal, now());
    timeoutId = setTimeout(async () => {
      try {
        await runFindingOverdueSync({ alfrescoClient, username, password, notificationService, logger, now });
      } catch (error) {
        logger.error('Finding overdue sync failed', error);
      } finally {
        schedule();
      }
    }, waitMs);
  };

  schedule();
  logger.info('Finding overdue sync job scheduled', { runHourLocal });

  return {
    stop: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
    runNow: () => runFindingOverdueSync({ alfrescoClient, username, password, notificationService, logger, now }),
  };
}

module.exports = {
  startFindingOverdueJob,
  runFindingOverdueSync,
};