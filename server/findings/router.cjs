const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { mapFindingNode, mapFollowUpReportNode, getFollowUpReportsForFinding } = require('../domain/alfrescoMappers.cjs');
const { parseFollowUpId, buildFollowUpIdFromFinding } = require('../domain/idFormats.cjs');
const { FINDING_STATUS } = require('../domain/statusRules.cjs');
const { computeEffectiveFindingStatus } = require('../domain/statusRules.cjs');
const { isValidClosureRequest, canReviewClosure } = require('../domain/statusRules.cjs');
const {
  canRequestDeadlineExtension,
  canReviewDeadlineExtension,
  isValidDeadlineExtensionDecision,
  parseIsoDate,
} = require('../domain/statusRules.cjs');
const {
  canReviewEvidence,
  isValidEvidenceReviewDecision,
  resolveFindingStatusFromFollowUp,
} = require('../domain/statusRules.cjs');
const { canReviewFinding } = require('../domain/statusRules.cjs');

const FINDINGS_LIBRARY_PATH = "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos";

function escapeAftsValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function extractUpstreamErrorDetail(error) {
  const payload = error?.response?.data;
  const briefSummary = payload?.error?.briefSummary;
  const message = payload?.error?.message;
  const errorKey = payload?.error?.errorKey;
  return briefSummary || message || payload?.message || payload?.error || errorKey || error?.message || 'Unknown error';
}

function buildFindingsQuery(filters = {}) {
  const predicates = [
    "TYPE:'vso:finding'",
    `PATH:'/app:company_home/st:sites/cm:vigilancia-de-la-so/cm:documentLibrary/cm:Vigilancia/cm:Hallazgos//*'`,
  ];

  // Plain phrase match, not the '=' exact-term operator: these properties
  // aren't configured for cross-locale indexing, and AFTS exact-term
  // search throws a 500 in Solr without it (UnsupportedOperationException:
  // "Exact Term search is not supported unless you configure the field
  // ... for cross locale search"). Phrase match on these opaque
  // single-token IDs/codes is behaviorally equivalent.
  if (filters.findingId) {
    predicates.push(`vso:findingId:"${escapeAftsValue(filters.findingId)}"`);
  }
  if (filters.inspectionId) {
    predicates.push(`vso:inspectionId:"${escapeAftsValue(filters.inspectionId)}"`);
  }
  if (filters.locationId) {
    predicates.push(`vso:locationId:"${escapeAftsValue(filters.locationId)}"`);
  }
  if (filters.providerId) {
    predicates.push(`vso:providerId:"${escapeAftsValue(filters.providerId)}"`);
  }
  if (filters.specialtyCode) {
    predicates.push(`vso:specialtyCode:"${escapeAftsValue(filters.specialtyCode)}"`);
  }
  if (filters.domain) {
    predicates.push(`vso:domain:"${escapeAftsValue(filters.domain)}"`);
  }

  return predicates.join(' AND ');
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseNonNegativeInt(value, fallback, { max = 100000 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const result = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      result[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return result;
}

function applyFindingScopeForFollowUps({ findingRows, status, statusMode, capOverdueOnly, solutionOverdueOnly }) {
  const normalizedStatusMode = statusMode === 'stored' ? 'stored' : 'effective';

  return findingRows.filter((row) => {
    if (status) {
      const candidateStatus = normalizedStatusMode === 'stored' ? row.statusMeta.storedStatus : row.statusMeta.effectiveStatus;
      if (candidateStatus !== status) {
        return false;
      }
    }

    if (String(capOverdueOnly || '').toLowerCase() === 'true' && !row.statusMeta.capOverdue) {
      return false;
    }

    if (String(solutionOverdueOnly || '').toLowerCase() === 'true' && row.statusMeta.effectiveStatus !== FINDING_STATUS.SOLUTION_OVERDUE) {
      return false;
    }

    return true;
  });
}

async function resolveRelatedCapId({ alfrescoClient, ticket, followUpNodeId }) {
  try {
    // Try target associations first (follow-up -> CAP)
    let relatedCaps = await alfrescoClient.listTargetAssociations({
      ticket,
      nodeId: followUpNodeId,
      assocType: 'vso:relatedCorrectiveAction',
      maxItems: 1,
    });

    if (relatedCaps.length === 0) {
      // Try source associations as fallback (CAP -> follow-up)
      relatedCaps = await alfrescoClient.listSourceAssociations({
        ticket,
        nodeId: followUpNodeId,
        assocType: 'vso:relatedCorrectiveAction',
        maxItems: 1,
      });
    }

    return relatedCaps[0]?.properties?.['vso:capId'] || null;
  } catch (error) {
    // Log but don't fail the whole request if association lookup fails
    console.warn(`Failed to resolve CAP for follow-up ${followUpNodeId}:`, error.message);
    return null;
  }
}

function readLegacyInheritedCapId(node) {
  return node?.properties?.['vso:inheritedCapId'] || null;
}

function toDateOnly(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function findingIdFromFollowUpId(followUpId) {
  const parsed = parseFollowUpId(followUpId);
  if (!parsed) {
    return null;
  }
  return `${parsed.compactInspectionId}-${parsed.specialtyCode}-${String(parsed.findingSequence).padStart(2, '0')}`;
}

function applyFindingFilters({ findings, status, capOverdueOnly, solutionOverdueOnly, reviewStatus }) {
  return findings.filter((finding) => {
    if (status && finding.effectiveStatus !== status && finding.storedStatus !== status) {
      return false;
    }

    if (reviewStatus && finding.findingReviewStatus !== reviewStatus) {
      return false;
    }

    if (String(capOverdueOnly || '').toLowerCase() === 'true' && !finding.capOverdue) {
      return false;
    }

    if (String(solutionOverdueOnly || '').toLowerCase() === 'true' && finding.effectiveStatus !== FINDING_STATUS.SOLUTION_OVERDUE) {
      return false;
    }

    return true;
  });
}

function createFindingsRouter({ auth, alfrescoClient, now = () => new Date() }) {
  const router = express.Router();

  router.get(
    '/',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const query = buildFindingsQuery({
          findingId: req.query?.findingId,
          inspectionId: req.query?.inspectionId,
          locationId: req.query?.locationId,
          providerId: req.query?.providerId,
          specialtyCode: req.query?.specialtyCode,
          domain: req.query?.domain,
        });

        const findingNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query,
          maxItems: 1000,
        });

        const findings = await Promise.all(
          findingNodes.map(async (findingNode) => {
            const finding = mapFindingNode(findingNode);
            const followUpReports = await getFollowUpReportsForFinding({
              alfrescoClient,
              ticket: req.auth.ticket,
              findingNodeId: finding.nodeId,
            });
            const statusMeta = computeEffectiveFindingStatus({
              finding,
              followUpReports,
              now: now(),
            });

            return {
              ...finding,
              ...statusMeta,
            };
          })
        );

        const filtered = applyFindingFilters({
          findings,
          status: req.query?.status,
          capOverdueOnly: req.query?.capOverdueOnly,
          solutionOverdueOnly: req.query?.solutionOverdueOnly,
          reviewStatus: req.query?.reviewStatus,
        });

        return res.status(200).json({
          list: filtered,
          path: FINDINGS_LIBRARY_PATH,
        });
      } catch (error) {
        return res.status(502).json(buildError('FINDING_QUERY_FAILED', error.message));
      }
    }
  );

  router.get(
    '/follow-ups',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const skipCount = parseNonNegativeInt(req.query?.skipCount, 0);
        const maxItems = parsePositiveInt(req.query?.maxItems, 50, { min: 1, max: 200 });
        const findingMaxItems = parsePositiveInt(req.query?.findingMaxItems, 200, { min: 1, max: 1000 });
        const findingFetchConcurrency = parsePositiveInt(req.query?.findingFetchConcurrency, 8, { min: 1, max: 25 });
        const capResolveConcurrency = parsePositiveInt(req.query?.capResolveConcurrency, 10, { min: 1, max: 40 });

        let findingNodes;
        const explicitFindingId = String(req.query?.findingId || '').trim();
        if (explicitFindingId) {
          const findingNode = await alfrescoClient.searchFindingByBusinessId({
            ticket: req.auth.ticket,
            findingId: explicitFindingId,
          });
          findingNodes = findingNode ? [findingNode] : [];
        } else {
          findingNodes = await alfrescoClient.searchNodes({
            ticket: req.auth.ticket,
            query: buildFindingsQuery({
              inspectionId: req.query?.inspectionId,
              locationId: req.query?.locationId,
              providerId: req.query?.providerId,
              specialtyCode: req.query?.specialtyCode,
              domain: req.query?.domain,
            }),
            maxItems: findingMaxItems,
          });
        }

        const findingRows = await mapWithConcurrency(findingNodes, findingFetchConcurrency, async (node) => {
          const finding = mapFindingNode(node);
          const followUpReports = await getFollowUpReportsForFinding({
            alfrescoClient,
            ticket: req.auth.ticket,
            findingNodeId: finding.nodeId,
          });
          const statusMeta = computeEffectiveFindingStatus({
            finding,
            followUpReports,
            now: now(),
          });

          return {
            finding,
            followUpReports,
            statusMeta,
          };
        });

        const scopedFindings = applyFindingScopeForFollowUps({
          findingRows,
          status: req.query?.status,
          statusMode: req.query?.statusMode,
          capOverdueOnly: req.query?.capOverdueOnly,
          solutionOverdueOnly: req.query?.solutionOverdueOnly,
        });

        const requestedType = String(req.query?.followUpType || '').trim().toUpperCase();
        const unresolvedList = scopedFindings.flatMap((row) => row.followUpReports
          .filter((report) => {
            if (!requestedType) {
              return true;
            }
            return String(report.followUpType || '').trim().toUpperCase() === requestedType;
          })
          .map((report) => ({
            ...report,
            findingNodeId: row.finding.nodeId,
            findingId: row.finding.findingId || findingIdFromFollowUpId(report.followUpId),
            storedFindingStatus: row.statusMeta.storedStatus,
            effectiveFindingStatus: row.statusMeta.effectiveStatus,
            legacyInheritedCapId: readLegacyInheritedCapId(report),
          })));

        const fallbackCapCache = new Map();
        async function resolveFallbackCapIdByFindingNodeId(findingNodeId) {
          if (!findingNodeId) {
            return null;
          }
          if (fallbackCapCache.has(findingNodeId)) {
            return fallbackCapCache.get(findingNodeId);
          }

          const siblingCaps = await alfrescoClient.listChildrenByType({
            ticket: req.auth.ticket,
            parentNodeId: findingNodeId,
            nodeType: 'vso:correctiveAction',
            maxItems: 200,
          });

          const fallbackCapId = siblingCaps.length === 1
            ? siblingCaps[0]?.properties?.['vso:capId'] || null
            : null;

          fallbackCapCache.set(findingNodeId, fallbackCapId);
          return fallbackCapId;
        }

        const resolvedList = await mapWithConcurrency(unresolvedList, capResolveConcurrency, async (entry) => ({
          ...entry,
          inheritedCapId: (await resolveRelatedCapId({
            alfrescoClient,
            ticket: req.auth.ticket,
            followUpNodeId: entry.nodeId,
          })) || entry.legacyInheritedCapId || (await resolveFallbackCapIdByFindingNodeId(entry.findingNodeId)),
        }));

        const sorted = resolvedList.sort((left, right) => {
          const byDate = String(right.followUpDate || '').localeCompare(String(left.followUpDate || ''));
          if (byDate !== 0) {
            return byDate;
          }
          return String(right.followUpId || '').localeCompare(String(left.followUpId || ''));
        });

        const totalItems = sorted.length;
        const list = sorted.slice(skipCount, skipCount + maxItems);

        return res.status(200).json({
          list,
          paging: {
            skipCount,
            maxItems,
            count: list.length,
            totalItems,
            hasMoreItems: skipCount + list.length < totalItems,
          },
          scopeMeta: {
            statusMode: req.query?.statusMode === 'stored' ? 'stored' : 'effective',
            scannedFindings: findingRows.length,
            matchedFindings: scopedFindings.length,
            concurrency: {
              findingFetch: findingFetchConcurrency,
              capResolve: capResolveConcurrency,
            },
          },
        });
      } catch (error) {
        return res.status(502).json(buildError('FOLLOW_UP_QUERY_FAILED', error.message));
      }
    }
  );

  router.post(
    '/:findingId/follow-ups',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });

        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const finding = mapFindingNode(findingNode);
        const followUpType = String(req.body?.followUpType || '').trim();
        if (!followUpType) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', 'followUpType is required'));
        }

        const followUpDate = req.body?.followUpDate || new Date(now()).toISOString();
        const findingClosed = Boolean(req.body?.findingClosed);
        const percentComplete = Number(req.body?.percentComplete ?? 0);
        const followUpClosureDate = String(req.body?.followUpClosureDate || '').trim();
        const closureVerificationMethod = String(req.body?.closureVerificationMethod || '').trim();
        const effectivenessConfirmed = Boolean(req.body?.effectivenessConfirmed);

        if (Number.isNaN(percentComplete) || percentComplete < 0 || percentComplete > 100) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', 'percentComplete must be between 0 and 100'));
        }

        if (!isValidClosureRequest({ followUpType, findingClosed, effectivenessConfirmed })) {
          return res.status(400).json(buildError(
            'FOLLOW_UP_INVALID_CLOSURE',
            'Closing a finding requires followUpType "Closure Verification" and effectivenessConfirmed=true'
          ));
        }

        const existingFollowUps = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: finding.nodeId,
          nodeType: 'vso:followUpReport',
        });

        const maxExistingSequence = existingFollowUps.reduce((max, entry) => {
          const parsed = parseFollowUpId(entry?.properties?.['vso:followUpId']);
          return parsed ? Math.max(max, parsed.followUpSequence) : max;
        }, 0);
        const nextSequence = maxExistingSequence + 1;

        let followUpId;
        try {
          followUpId = buildFollowUpIdFromFinding({
            findingId: finding.findingId,
            followUpSequence: nextSequence,
          });
        } catch (error) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', error.message));
        }

        if (nextSequence > 99) {
          return res.status(409).json(buildError('FOLLOW_UP_ALREADY_EXISTS', 'Maximum number of follow-ups (99) reached for this finding'));
        }

        const siblingCaps = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: finding.nodeId,
          nodeType: 'vso:correctiveAction',
        });
        const requestedCapId = String(req.body?.inheritedCapId || '').trim().toUpperCase();
        const selectedCap = requestedCapId
          ? siblingCaps.find((entry) => String(entry?.properties?.['vso:capId'] || '').trim().toUpperCase() === requestedCapId)
          : null;

        if (requestedCapId && !selectedCap) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', 'inheritedCapId must belong to the provided findingId'));
        }

        const inheritedCapId = selectedCap?.properties?.['vso:capId'] || null;
        const created = await alfrescoClient.createChildNode({
          ticket: req.auth.ticket,
          parentNodeId: finding.nodeId,
          nodeType: 'vso:followUpReport',
          name: followUpId,
          associationType: 'vso:hasFollowUp',
          properties: {
            'vso:followUpId': followUpId,
            'vso:followUpType': followUpType,
            'vso:followUpDate': followUpDate,
            'vso:percentComplete': percentComplete,
            ...(followUpClosureDate ? { 'vso:followUpClosureDate': followUpClosureDate } : {}),
            ...(closureVerificationMethod ? { 'vso:closureVerificationMethod': closureVerificationMethod } : {}),
            'vso:effectivenessConfirmed': effectivenessConfirmed,
            // Evidence must be reviewed and confirmed Adequate before it can
            // affect vso:findingStatus (see PATCH .../evidence-review below)
            // — submitting a follow-up never changes the finding's status.
            'vso:evidenceReviewStatus': 'Pending Review',
            'vso:inspectionId': finding.inspectionId,
            'vso:locationId': finding.locationId,
            ...(finding.locationCode ? { 'vso:locationCode': finding.locationCode } : {}),
            'vso:locationName': finding.locationName,
            'vso:specialtyCode': finding.specialtyCode,
            'vso:specialtyId': finding.specialtyId,
            'vso:specialtyName': finding.specialtyName,
            'vso:providerId': finding.providerId,
            'vso:providerName': finding.providerName,
          },
        });

        if (selectedCap) {
          await alfrescoClient.createTargetAssociation({
            ticket: req.auth.ticket,
            sourceNodeId: created.id,
            targetNodeId: selectedCap.id,
            assocType: 'vso:relatedCorrectiveAction',
          });
        }

        return res.status(201).json({
          followUpReport: {
            ...mapFollowUpReportNode(created),
            findingId: finding.findingId,
            inheritedCapId,
          },
        });
      } catch (error) {
        const upstreamStatus = Number(error?.response?.status || 0);
        const upstreamDetail = extractUpstreamErrorDetail(error);
        console.error('Follow-up creation failed', {
          findingId: req.params.findingId,
          followUpType: req.body?.followUpType || null,
          status: upstreamStatus || null,
          message: upstreamDetail,
        });

        if (upstreamStatus >= 400 && upstreamStatus < 500) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', upstreamDetail));
        }

        return res.status(502).json(buildError('FOLLOW_UP_CREATE_FAILED', upstreamDetail));
      }
    }
  );

  router.patch(
    '/:findingId/follow-ups/:followUpId/evidence-review',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const decision = req.body?.decision;
        if (!isValidEvidenceReviewDecision(decision)) {
          return res.status(400).json(buildError('EVIDENCE_REVIEW_BAD_DECISION', 'decision must be "Adequate" or "Inadequate"'));
        }

        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });
        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const followUpNodes = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: findingNode.id,
          nodeType: 'vso:followUpReport',
        });
        const followUpNode = followUpNodes.find(
          (entry) => entry?.properties?.['vso:followUpId'] === req.params.followUpId
        );
        if (!followUpNode) {
          return res.status(404).json(buildError('FOLLOW_UP_NOT_FOUND', 'Follow-up report not found'));
        }

        const currentEvidenceReviewStatus = followUpNode?.properties?.['vso:evidenceReviewStatus'];
        if (!canReviewEvidence(currentEvidenceReviewStatus)) {
          return res.status(409).json(buildError('EVIDENCE_NOT_REVIEWABLE', 'Only evidence in Pending Review status can be reviewed'));
        }

        const notes = String(req.body?.notes || '').trim();
        const updatedFollowUp = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: followUpNode.id,
          properties: {
            'vso:evidenceReviewStatus': decision,
            'vso:evidenceReviewNotes': notes || null,
            'vso:evidenceReviewDate': toDateOnly(now()),
          },
        });

        let updatedFinding = findingNode;
        if (decision === 'Adequate') {
          const nextFindingStatus = resolveFindingStatusFromFollowUp({
            followUpType: followUpNode?.properties?.['vso:followUpType'],
            effectivenessConfirmed: followUpNode?.properties?.['vso:effectivenessConfirmed'],
            percentComplete: followUpNode?.properties?.['vso:percentComplete'],
          });

          updatedFinding = await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: findingNode.id,
            properties: {
              'vso:findingStatus': nextFindingStatus,
              'vso:lastStatusChange': toDateOnly(now()),
            },
          });
        }

        return res.status(200).json({
          followUpReport: mapFollowUpReportNode(updatedFollowUp),
          finding: mapFindingNode(updatedFinding),
        });
      } catch (error) {
        return res.status(502).json(buildError('EVIDENCE_REVIEW_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/:findingId/review',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });
        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const currentReviewStatus = findingNode?.properties?.['vso:findingReviewStatus'];
        if (!canReviewFinding(currentReviewStatus)) {
          return res.status(409).json(buildError('FINDING_ALREADY_REVIEWED', 'This finding has already been reviewed'));
        }

        // Fields a reviewer may correct before confirming — the content a
        // field inspector formulated directly, not identifiers, dates, or
        // the findingStatus/findingReviewStatus lifecycle fields themselves.
        const EDITABLE_FIELDS = {
          description: 'vso:description',
          findingLevel: 'vso:findingLevel',
          findingSeverity: 'vso:findingSeverity',
          riskClassification: 'vso:riskClassification',
          targetResidualRisk: 'vso:targetResidualRisk',
          requirementBreached: 'vso:requirementBreached',
        };

        const edits = {};
        for (const [bodyKey, alfrescoKey] of Object.entries(EDITABLE_FIELDS)) {
          if (req.body?.[bodyKey] !== undefined) {
            edits[alfrescoKey] = req.body[bodyKey];
          }
        }

        const updatedFinding = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: findingNode.id,
          properties: {
            ...edits,
            'vso:findingReviewStatus': 'Confirmed',
            'vso:findingReviewDate': toDateOnly(now()),
          },
        });

        return res.status(200).json({
          finding: mapFindingNode(updatedFinding),
        });
      } catch (error) {
        return res.status(502).json(buildError('FINDING_REVIEW_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/:findingId/closure-review',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const decision = req.body?.decision;
        if (decision !== 'approve' && decision !== 'reject') {
          return res.status(400).json(buildError('CLOSURE_REVIEW_BAD_DECISION', 'decision must be "approve" or "reject"'));
        }

        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });
        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const currentStatus = findingNode?.properties?.['vso:findingStatus'];
        if (!canReviewClosure(currentStatus)) {
          return res.status(409).json(buildError('FINDING_NOT_REVIEWABLE', 'Only findings in Pending Closure Approval status can be reviewed'));
        }

        const statusProperties = {
          'vso:findingStatus': decision === 'approve' ? FINDING_STATUS.CLOSED : FINDING_STATUS.IN_PROGRESS,
          'vso:lastStatusChange': toDateOnly(now()),
        };
        if (decision === 'approve') {
          statusProperties['vso:findingClosureDate'] = toDateOnly(now());
        }

        const updatedFinding = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: findingNode.id,
          properties: statusProperties,
        });

        return res.status(200).json({
          finding: mapFindingNode(updatedFinding),
        });
      } catch (error) {
        return res.status(502).json(buildError('CLOSURE_REVIEW_FAILED', error.message));
      }
    }
  );

  router.post(
    '/:findingId/deadline-extension-requests',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const requestedResolutionDeadline = String(req.body?.requestedResolutionDeadline || '').trim();
        const parsedRequested = parseIsoDate(requestedResolutionDeadline);
        if (!parsedRequested) {
          return res.status(400).json(buildError('DEADLINE_EXTENSION_BAD_REQUEST', 'requestedResolutionDeadline must be a valid date'));
        }

        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });
        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const currentResolutionDeadline = parseIsoDate(findingNode?.properties?.['vso:resolutionDeadline']);
        if (currentResolutionDeadline && parsedRequested <= currentResolutionDeadline) {
          return res.status(400).json(buildError('DEADLINE_EXTENSION_NOT_LATER', 'requestedResolutionDeadline must be later than the current resolutionDeadline'));
        }

        const currentStatus = findingNode?.properties?.['vso:deadlineExtensionStatus'];
        if (!canRequestDeadlineExtension(currentStatus)) {
          return res.status(409).json(buildError('DEADLINE_EXTENSION_ALREADY_PENDING', 'A deadline extension request is already pending for this finding'));
        }

        const reason = String(req.body?.reason || '').trim();
        const updatedFinding = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: findingNode.id,
          properties: {
            'vso:deadlineExtensionStatus': 'Requested',
            'vso:requestedResolutionDeadline': requestedResolutionDeadline,
            'vso:deadlineExtensionReason': reason || null,
            'vso:deadlineExtensionRequestedDate': toDateOnly(now()),
          },
        });

        return res.status(201).json({
          finding: mapFindingNode(updatedFinding),
        });
      } catch (error) {
        return res.status(502).json(buildError('DEADLINE_EXTENSION_REQUEST_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/:findingId/deadline-extension-review',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const decision = req.body?.decision;
        if (!isValidDeadlineExtensionDecision(decision)) {
          return res.status(400).json(buildError('DEADLINE_EXTENSION_BAD_DECISION', 'decision must be "Accepted" or "Rejected"'));
        }

        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });
        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const currentStatus = findingNode?.properties?.['vso:deadlineExtensionStatus'];
        if (!canReviewDeadlineExtension(currentStatus)) {
          return res.status(409).json(buildError('DEADLINE_EXTENSION_NOT_REVIEWABLE', 'Only a Requested deadline extension can be reviewed'));
        }

        const properties = {
          'vso:deadlineExtensionStatus': decision,
          'vso:deadlineExtensionDecisionDate': toDateOnly(now()),
        };
        if (decision === 'Accepted') {
          properties['vso:resolutionDeadline'] = findingNode?.properties?.['vso:requestedResolutionDeadline'];
        }

        const updatedFinding = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: findingNode.id,
          properties,
        });

        return res.status(200).json({
          finding: mapFindingNode(updatedFinding),
        });
      } catch (error) {
        return res.status(502).json(buildError('DEADLINE_EXTENSION_REVIEW_FAILED', error.message));
      }
    }
  );

  router.get(
    '/:findingId',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });

        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const finding = mapFindingNode(findingNode);
        const followUpReports = await getFollowUpReportsForFinding({
          alfrescoClient,
          ticket: req.auth.ticket,
          findingNodeId: finding.nodeId,
        });

        return res.status(200).json({
          ...finding,
          ...computeEffectiveFindingStatus({
            finding,
            followUpReports,
            now: now(),
          }),
          followUpReports,
        });
      } catch (error) {
        return res.status(502).json(buildError('FINDING_DETAIL_FAILED', error.message));
      }
    }
  );

  return router;
}

module.exports = {
  createFindingsRouter,
};