const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { mapFindingNode, mapCorrectiveActionNode } = require('../domain/alfrescoMappers.cjs');
const {
  computeStatusCounts,
  computeSeverityTrend,
  computeOverdueAging,
  computeCapCycleTime,
  computeRecurrence,
  computeProviderRanking,
  computeFilterOptions,
} = require('./postureAggregator.cjs');

function escapeAftsValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function escapeAftsDate(value) {
  // Only ISO-ish date strings are ever interpolated unescaped into a
  // range predicate; reject anything else rather than risk AFTS syntax
  // injection through a malformed dateFrom/dateTo query param.
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? value : null;
}

function buildDateRangePredicate(field, dateFrom, dateTo) {
  const from = escapeAftsDate(dateFrom) || 'MIN';
  const to = escapeAftsDate(dateTo) || 'MAX';
  if (from === 'MIN' && to === 'MAX') {
    return null;
  }
  return `${field}:[${from} TO ${to}]`;
}

function buildReportFindingsQuery(filters = {}) {
  const predicates = [
    "TYPE:'vso:finding'",
    `PATH:'/app:company_home/st:sites/cm:vigilancia-de-la-so/cm:documentLibrary/cm:Vigilancia/cm:Hallazgos//*'`,
  ];

  // Plain phrase match, not the '=' exact-term operator: vso:locationId/
  // vso:providerId aren't configured for cross-locale indexing, and AFTS
  // exact-term search throws a 500 in Solr without it. Phrase match on
  // these opaque single-token IDs is behaviorally equivalent.
  if (filters.locationId) {
    predicates.push(`vso:locationId:"${escapeAftsValue(filters.locationId)}"`);
  }
  if (filters.providerId) {
    predicates.push(`vso:providerId:"${escapeAftsValue(filters.providerId)}"`);
  }

  const dateRange = buildDateRangePredicate('vso:dateIssued', filters.dateFrom, filters.dateTo);
  if (dateRange) {
    predicates.push(dateRange);
  }

  return predicates.join(' AND ');
}

function buildReportCapsQuery(filters = {}) {
  const predicates = ["TYPE:'vso:correctiveAction'"];

  if (filters.locationId) {
    predicates.push(`vso:locationId:"${escapeAftsValue(filters.locationId)}"`);
  }
  if (filters.providerId) {
    predicates.push(`vso:providerId:"${escapeAftsValue(filters.providerId)}"`);
  }

  return predicates.join(' AND ');
}

function createReportsRouter({ auth, alfrescoClient, now = () => new Date() }) {
  const router = express.Router();

  router.get(
    '/oversight-posture/filter-options',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'reporter', 'admin']),
    async (req, res) => {
      try {
        const findingNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query: buildReportFindingsQuery({}),
          maxItems: 1000,
        });

        const findings = findingNodes.map(mapFindingNode);

        return res.status(200).json({
          success: true,
          ...computeFilterOptions(findings),
        });
      } catch (error) {
        return res.status(502).json(buildError('OVERSIGHT_POSTURE_FILTER_OPTIONS_FAILED', error.message));
      }
    }
  );

  router.get(
    '/oversight-posture',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'reporter', 'admin']),
    async (req, res) => {
      try {
        const filters = {
          providerId: req.query?.providerId,
          locationId: req.query?.locationId,
          dateFrom: req.query?.dateFrom,
          dateTo: req.query?.dateTo,
        };

        // Sequential, not Promise.all: this is the only endpoint in this
        // backend that issues two searches for one request. Running them
        // concurrently on the same ticket was reliably producing a 500
        // from Solr with literal, unsubstituted AUTHORITY_FILTER_FROM_JSON/
        // TENANT_FILTER_FROM_JSON placeholders in the fq clauses — a
        // known Alfresco Search Services failure mode when its search
        // webscript builds the security filter under concurrent requests,
        // not a problem with the query text itself.
        const findingNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query: buildReportFindingsQuery(filters),
          maxItems: 1000,
        });
        const capNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query: buildReportCapsQuery(filters),
          maxItems: 1000,
        });

        const findings = findingNodes.map(mapFindingNode);
        const correctiveActions = capNodes.map(mapCorrectiveActionNode);
        const nowValue = now();

        return res.status(200).json({
          success: true,
          timestamp: new Date().toISOString(),
          filters,
          summary: {
            statusCounts: computeStatusCounts(findings),
            severityTrend: computeSeverityTrend(findings),
            overdueAging: computeOverdueAging(findings, nowValue),
            capCycleTime: computeCapCycleTime(findings, correctiveActions),
            recurrence: computeRecurrence(findings),
            providerRanking: computeProviderRanking(findings),
          },
        });
      } catch (error) {
        return res.status(502).json(buildError('OVERSIGHT_POSTURE_REPORT_FAILED', error.message));
      }
    }
  );

  router.get(
    '/provider-history',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'reporter', 'admin']),
    async (req, res) => {
      try {
        const providerId = String(req.query?.providerId || '').trim();
        if (!providerId) {
          return res.status(400).json(buildError('PROVIDER_HISTORY_BAD_REQUEST', 'providerId is required'));
        }

        const year = String(req.query?.year || '').trim() || undefined;

        const report = await alfrescoClient.getProviderHistoryReport({
          ticket: req.auth.ticket,
          providerId,
          year,
        });

        return res.status(200).json(report);
      } catch (error) {
        const upstreamStatus = Number(error?.response?.status || 0);
        const upstreamDetail = error?.response?.data?.error || error?.response?.data?.message || error.message;

        if (upstreamStatus >= 400 && upstreamStatus < 500) {
          return res.status(400).json(buildError('PROVIDER_HISTORY_BAD_REQUEST', upstreamDetail));
        }

        return res.status(502).json(buildError('PROVIDER_HISTORY_REPORT_FAILED', upstreamDetail));
      }
    }
  );

  router.get(
    '/usoap-ce-evidence',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'reporter', 'admin']),
    async (req, res) => {
      try {
        const ce = String(req.query?.ce || '').trim();
        if (!ce) {
          return res.status(400).json(buildError('USOAP_CE_EVIDENCE_BAD_REQUEST', 'ce is required'));
        }

        const year = String(req.query?.year || '').trim() || undefined;

        let populationQueries;
        if (req.query?.populationQueries) {
          try {
            populationQueries = JSON.parse(req.query.populationQueries);
          } catch {
            return res.status(400).json(buildError('USOAP_CE_EVIDENCE_BAD_REQUEST', 'populationQueries must be valid JSON'));
          }
        }

        const report = await alfrescoClient.generateCeEvidenceReport({
          ticket: req.auth.ticket,
          ce,
          year,
          populationQueries,
        });

        return res.status(200).json(report);
      } catch (error) {
        const upstreamStatus = Number(error?.response?.status || 0);
        const upstreamDetail = error?.response?.data?.error || error?.response?.data?.message || error.message;

        if (upstreamStatus >= 400 && upstreamStatus < 500) {
          return res.status(400).json(buildError('USOAP_CE_EVIDENCE_BAD_REQUEST', upstreamDetail));
        }

        return res.status(502).json(buildError('USOAP_CE_EVIDENCE_REPORT_FAILED', upstreamDetail));
      }
    }
  );

  return router;
}

module.exports = {
  createReportsRouter,
  buildReportFindingsQuery,
  buildReportCapsQuery,
};
