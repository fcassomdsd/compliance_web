const { notifyRoleInbox } = require('../notifications/roleNotify.cjs');

function nowIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function addMonths(dateStr, months) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

const SITE_VISIT_CODE_PATTERN = /^([A-Za-z0-9]{4})-(\d{3})$/;

// Mirrors src/stores/siteVisitStore.js's addSiteVisit code-generation
// algorithm exactly, so auto-scheduled and manually-created site visits at
// the same location share one continuous sequence.
function computeNextSiteVisitCode({ locationIcaoCode, existingSiteVisits }) {
  let maxSequence = 0;
  for (const siteVisit of existingSiteVisits) {
    const match = String(siteVisit?.code || '').trim().match(SITE_VISIT_CODE_PATTERN);
    if (!match) continue;
    if (match[1].toUpperCase() !== locationIcaoCode) continue;
    const sequence = Number.parseInt(match[2], 10);
    if (Number.isInteger(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }
  const nextSequence = (maxSequence + 1).toString().padStart(3, '0');
  return `${locationIcaoCode}-${nextSequence}`;
}

async function runSiteVisitSchedulingSync({
  alfrescoClient,
  nodeRedClient,
  username,
  password,
  notificationService,
  logger = console,
  now = () => new Date(),
}) {
  if (!username || !password) {
    logger.warn('Site visit scheduling job skipped: ALFRESCO_JOB_USERNAME/ALFRESCO_JOB_PASSWORD not configured');
    return { skipped: true, created: 0 };
  }

  const auth = await alfrescoClient.createTicket(username, password);
  const ticket = auth.ticket;

  try {
    const today = nowIsoDate(now());

    const cadenceResult = await nodeRedClient.queryEntity({
      ticket,
      entity: 'InspectionCadence',
      data: { active: true },
    });
    const dueCadences = (cadenceResult.list || []).filter(
      (cadence) => cadence.nextDueDate && cadence.nextDueDate <= today
    );

    const createdSummaries = [];

    for (const cadence of dueCadences) {
      const locationResult = await nodeRedClient.queryEntity({
        ticket,
        entity: 'Location',
        data: { id: cadence.locationId },
      });
      const location = (locationResult.list || [])[0];
      const locationIcaoCode = location?.icaoCode?.trim().toUpperCase();
      if (!locationIcaoCode) {
        logger.warn('Skipping due cadence: location missing or has no ICAO code', { cadenceId: cadence.id });
        continue;
      }

      const existingSiteVisitsResult = await nodeRedClient.queryEntity({
        ticket,
        entity: 'SiteVisit',
        data: { deleted: false, locationId: cadence.locationId },
      });
      const code = computeNextSiteVisitCode({
        locationIcaoCode,
        existingSiteVisits: existingSiteVisitsResult.list || [],
      });

      const siteVisit = await nodeRedClient.addEntity({
        ticket,
        entity: 'SiteVisit',
        data: {
          locationId: cadence.locationId,
          startDate: today,
          code,
          status: 'Created',
        },
      });

      await nodeRedClient.addEntity({
        ticket,
        entity: 'Inspection',
        data: {
          siteVisitId: siteVisit.id,
          inspectedProviderId: cadence.inspectedProviderId,
          code,
          status: 'Created',
          inspectionType: cadence.inspectionType || 'Inspection',
        },
      });

      await nodeRedClient.updateEntity({
        ticket,
        entity: 'InspectionCadence',
        id: cadence.id,
        data: {
          lastScheduledDate: today,
          nextDueDate: addMonths(today, cadence.intervalMonths),
        },
      });

      createdSummaries.push({
        code,
        provider: cadence.inspectedProviderName || cadence.inspectedProviderId,
        specialty: cadence.specialtyName || cadence.specialtyId,
        location: cadence.locationName || cadence.locationId,
      });
    }

    if (createdSummaries.length > 0) {
      await notifyRoleInbox({
        notificationService,
        envVar: 'PLANNER_NOTIFICATIONS_EMAIL',
        eventType: 'site_visit_auto_scheduled',
        subject: `${createdSummaries.length} site visit(s) auto-scheduled`,
        body: [
          'The following site visits were automatically created from recurring inspection cadences:',
          ...createdSummaries.map((s) => `- ${s.code}: ${s.provider} / ${s.specialty} at ${s.location}`),
        ].join('\n'),
        context: { codes: createdSummaries.map((s) => s.code) },
      });
    }

    logger.info('Site visit scheduling sync completed', {
      created: createdSummaries.length,
      dueCadences: dueCadences.length,
    });
    return { skipped: false, created: createdSummaries.length };
  } finally {
    await alfrescoClient.revokeTicket(ticket).catch(() => undefined);
  }
}

function untilNextRunMs(hourLocal = 2, now = new Date()) {
  const next = new Date(now);
  next.setHours(hourLocal, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function startSiteVisitSchedulingJob({
  alfrescoClient,
  nodeRedClient,
  username,
  password,
  notificationService,
  logger = console,
  now = () => new Date(),
  runHourLocal = 2,
}) {
  let timeoutId = null;

  const schedule = () => {
    const waitMs = untilNextRunMs(runHourLocal, now());
    timeoutId = setTimeout(async () => {
      try {
        await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username, password, notificationService, logger, now });
      } catch (error) {
        logger.error('Site visit scheduling sync failed', error);
      } finally {
        schedule();
      }
    }, waitMs);
  };

  schedule();
  logger.info('Site visit scheduling job scheduled', { runHourLocal });

  return {
    stop: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
    runNow: () => runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username, password, notificationService, logger, now }),
  };
}

module.exports = {
  startSiteVisitSchedulingJob,
  runSiteVisitSchedulingSync,
  computeNextSiteVisitCode,
};
