const { notifyRoleInbox } = require('../notifications/roleNotify.cjs');
const {
  parseSiteVisitCode,
  parseActivityCode,
  buildSiteVisitCode,
  buildActivityCode,
} = require('../domain/idFormats.cjs');

// Default activity type letter when a cadence does not name one. Mirrors
// DEFAULT_ACTIVITY_TYPE_CODE in src/utils/documentCodes.js.
const DEFAULT_ACTIVITY_TYPE_CODE = 'I';

function nowIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function addMonths(dateStr, months) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
  return date.toISOString().slice(0, 10);
}

// Mirrors src/stores/siteVisitStore.js's addSiteVisit code-generation
// algorithm exactly, so auto-scheduled and manually-created site visits at
// the same location share one continuous sequence. Scoped by location AND
// year — the sequence resets each January per location.
function computeNextSiteVisitCode({ locationIcaoCode, year, existingSiteVisits }) {
  let maxSequence = 0;
  for (const siteVisit of existingSiteVisits) {
    const parts = parseSiteVisitCode(siteVisit?.code);
    if (!parts) continue;
    if (parts.icaoCode !== locationIcaoCode) continue;
    if (parts.year !== year) continue;
    if (parts.sequence > maxSequence) {
      maxSequence = parts.sequence;
    }
  }
  return buildSiteVisitCode({ icaoCode: locationIcaoCode, year, sequence: maxSequence + 1 });
}

// Mirrors src/stores/inspectionStore.js's addInspection code-generation.
// The Activity code is independent of its parent SiteVisit's code: scoped by
// location AND activity type letter, with a continuous 4-digit sequence that
// deliberately does not reset per year.
function computeNextActivityCode({ locationIcaoCode, activityTypeCode, existingInspections }) {
  let maxSequence = 0;
  for (const inspection of existingInspections) {
    const parts = parseActivityCode(inspection?.code);
    if (!parts) continue;
    if (parts.icaoCode !== locationIcaoCode) continue;
    if (parts.activityTypeCode !== activityTypeCode) continue;
    if (parts.sequence > maxSequence) {
      maxSequence = parts.sequence;
    }
  }
  return buildActivityCode({ icaoCode: locationIcaoCode, activityTypeCode, sequence: maxSequence + 1 });
}

// Resolves a cadence's LocationService, memoised for the duration of one sync
// run. A cadence hangs off the LocationService -- the authority-side registry of
// which provider offers which specialties at which location -- so this one lookup
// yields both the location the visit happens at and the provider being inspected.
// The cadence carries no location of its own; it is derived here.
function buildLocationServiceResolver({ nodeRedClient, ticket }) {
  const cache = new Map();

  return async function resolveLocationService(cadence) {
    const locationServiceId = cadence?.locationServiceId;
    if (!locationServiceId) return null;
    if (cache.has(locationServiceId)) return cache.get(locationServiceId);

    let resolved = null;
    try {
      const result = await nodeRedClient.queryEntity({
        ticket,
        entity: 'LocationService',
        data: { id: locationServiceId },
      });
      const locationService = (result.list || [])[0];
      if (locationService?.locationId && locationService?.serviceProviderId) {
        resolved = {
          locationId: locationService.locationId,
          serviceProviderId: locationService.serviceProviderId,
          serviceProviderName: locationService.serviceProviderName,
        };
      }
    } catch {
      // Leave it unresolved; the caller skips this cadence with a warning rather
      // than aborting the whole sweep.
    }

    cache.set(locationServiceId, resolved);
    return resolved;
  };
}

// Resolves a cadence's activity type letter, memoised for the duration of one
// sync run. Falls back to "I" (Inspeccion) when the cadence names no type.
function buildActivityTypeResolver({ nodeRedClient, ticket }) {
  const cache = new Map();

  return async function resolveActivityTypeCode(cadence) {
    const direct = String(cadence?.activityTypeCode || '').trim().toUpperCase();
    if (/^[A-Z]$/.test(direct)) return direct;

    const activityTypeId = cadence?.activityTypeId;
    if (!activityTypeId) return DEFAULT_ACTIVITY_TYPE_CODE;
    if (cache.has(activityTypeId)) return cache.get(activityTypeId);

    let resolved = DEFAULT_ACTIVITY_TYPE_CODE;
    try {
      const result = await nodeRedClient.queryEntity({
        ticket,
        entity: 'ActivityType',
        data: { id: activityTypeId },
      });
      const code = String((result.list || [])[0]?.code || '').trim().toUpperCase();
      if (/^[A-Z]$/.test(code)) resolved = code;
    } catch {
      // Fall back to the default letter rather than skipping the cadence.
    }

    cache.set(activityTypeId, resolved);
    return resolved;
  };
}

async function runSiteVisitSchedulingSync({
  alfrescoClient,
  nodeRedClient,
  username,
  password,
  notificationService,
  roleRecipients,
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
    const resolveLocationService = buildLocationServiceResolver({ nodeRedClient, ticket });
    const resolveActivityTypeCode = buildActivityTypeResolver({ nodeRedClient, ticket });
    const codeYear = Number.parseInt(today.slice(0, 4), 10);

    for (const cadence of dueCadences) {
      const locationService = await resolveLocationService(cadence);
      if (!locationService) {
        logger.warn('Skipping due cadence: location service missing, or has no location/provider', {
          cadenceId: cadence.id,
          locationServiceId: cadence.locationServiceId,
        });
        continue;
      }

      const locationResult = await nodeRedClient.queryEntity({
        ticket,
        entity: 'Location',
        data: { id: locationService.locationId },
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
        data: { deleted: false, locationId: locationService.locationId },
      });
      const code = computeNextSiteVisitCode({
        locationIcaoCode,
        year: codeYear,
        existingSiteVisits: existingSiteVisitsResult.list || [],
      });

      const siteVisit = await nodeRedClient.addEntity({
        ticket,
        entity: 'SiteVisit',
        data: {
          locationId: locationService.locationId,
          startDate: today,
          code,
          status: 'Created',
        },
      });

      // The provider's participation in *this* visit. InspectedProvider is the
      // (SiteVisit x ServiceProvider) junction, and it is the only path an
      // Inspection has to its SiteVisit — Inspection declares no siteVisit field
      // at all, so the visit is reached via Inspection -> inspectedProvider ->
      // siteVisit. A fresh row per visit is therefore mandatory: reusing one from
      // an earlier visit would file this Inspection against that older visit and
      // leave the visit just created with nothing attached to it.
      //
      // `name` is required on InspectedProvider; the fallback mirrors
      // src/stores/inspectedProviderStore.js so manually-added and
      // auto-scheduled providers are named identically.
      const inspectedProvider = await nodeRedClient.addEntity({
        ticket,
        entity: 'InspectedProvider',
        data: {
          siteVisitId: siteVisit.id,
          serviceProviderId: locationService.serviceProviderId,
          serviceProviderName: locationService.serviceProviderName,
          name: locationService.serviceProviderName || locationService.serviceProviderId,
        },
      });

      // The Activity gets its own independently-sequenced code. Inspection
      // carries no locationId, so the scan cannot be filtered server-side —
      // fetch the active set and filter on the parsed code.
      const activityTypeCode = await resolveActivityTypeCode(cadence);
      const existingInspectionsResult = await nodeRedClient.queryEntity({
        ticket,
        entity: 'Inspection',
        data: { deleted: false },
      });
      const activityCode = computeNextActivityCode({
        locationIcaoCode,
        activityTypeCode,
        existingInspections: existingInspectionsResult.list || [],
      });

      // No siteVisitId here: Inspection has no such field, so passing one was
      // silently discarded. The link runs through inspectedProvider above.
      await nodeRedClient.addEntity({
        ticket,
        entity: 'Inspection',
        data: {
          inspectedProviderId: inspectedProvider.id,
          code: activityCode,
          status: 'Created',
          activityTypeId: cadence.activityTypeId || null,
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
        provider: locationService.serviceProviderName || locationService.serviceProviderId,
        specialty: cadence.specialtyName || cadence.specialtyId,
        location: location.name || locationIcaoCode,
      });
    }

    if (createdSummaries.length > 0) {
      await notifyRoleInbox({
        notificationService,
        roleRecipients,
        role: 'planner',
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
  roleRecipients,
  logger = console,
  now = () => new Date(),
  runHourLocal = 2,
}) {
  let timeoutId = null;

  const schedule = () => {
    const waitMs = untilNextRunMs(runHourLocal, now());
    timeoutId = setTimeout(async () => {
      try {
        await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username, password, notificationService, roleRecipients, logger, now });
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
    runNow: () => runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username, password, notificationService, roleRecipients, logger, now }),
  };
}

module.exports = {
  startSiteVisitSchedulingJob,
  runSiteVisitSchedulingSync,
  computeNextSiteVisitCode,
  computeNextActivityCode,
};
