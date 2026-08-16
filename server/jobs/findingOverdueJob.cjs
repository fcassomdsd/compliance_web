const { mapFindingNode, mapFollowUpReportNode, getFollowUpReportsForFinding } = require('../domain/alfrescoMappers.cjs');
const { computeEffectiveFindingStatus, FINDING_STATUS } = require('../domain/statusRules.cjs');

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

async function runFindingOverdueSync({ alfrescoClient, username, password, logger = console, now = () => new Date() }) {
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

    for (const findingNode of findings) {
      const finding = mapFindingNode(findingNode);
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

    logger.info('Finding overdue sync completed', { updated, drift, total: findings.length });
    return { skipped: false, updated, drift };
  } finally {
    await alfrescoClient.revokeTicket(ticket).catch(() => undefined);
  }
}

function startFindingOverdueJob({
  alfrescoClient,
  username,
  password,
  logger = console,
  now = () => new Date(),
  runHourLocal = 1,
}) {
  let timeoutId = null;

  const schedule = () => {
    const waitMs = untilNextRunMs(runHourLocal, now());
    timeoutId = setTimeout(async () => {
      try {
        await runFindingOverdueSync({ alfrescoClient, username, password, logger, now });
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
    runNow: () => runFindingOverdueSync({ alfrescoClient, username, password, logger, now }),
  };
}

module.exports = {
  startFindingOverdueJob,
  runFindingOverdueSync,
};