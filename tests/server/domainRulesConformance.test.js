// Conformance test for the shared, cross-repo domain-rule spec.
//
// domain-rules/nomenclatura.spec.json is vendored from compliance_cmis (the
// canonical copy). This suite runs the shared vectors against both id-format
// modules (server CJS + client ESM) and against the severity-deadline helper,
// so any implementation that drifts from the published rules fails here.
//
// Keep the assertions vector-driven: add cases to the spec, not to this file.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import domainSpec from '../../domain-rules/nomenclatura.spec.json';
import {
  parseSiteVisitCode as parseSiteVisitCodeClient,
  parseActivityCode as parseActivityCodeClient,
  buildSiteVisitCode as buildSiteVisitCodeClient,
  buildActivityCode as buildActivityCodeClient,
} from '../../src/utils/documentCodes.js';

const require = createRequire(import.meta.url);
const idFormats = require('../../server/domain/idFormats.cjs');
const { computeDeadlinesForSeverity } = require('../../server/findings/severityDeadlines.cjs');

const PATTERN_EXPORTS = {
  siteVisit: 'SITE_VISIT_CODE_PATTERN',
  activity: 'ACTIVITY_CODE_PATTERN',
  checklist: 'CHECKLIST_ID_PATTERN',
  finding: 'FINDING_ID_PATTERN',
  correctiveAction: 'CAP_ID_PATTERN',
  followUp: 'FOLLOW_UP_ID_PATTERN',
};

const PARSERS = {
  siteVisit: (value) => idFormats.parseSiteVisitCode(value),
  activity: (value) => idFormats.parseActivityCode(value),
  checklist: (value) => idFormats.parseChecklistId(value),
  finding: (value) => idFormats.parseFindingId(value),
  correctiveAction: (value) => idFormats.parseCapId(value),
  followUp: (value) => idFormats.parseFollowUpId(value),
};

const BUILDERS = {
  siteVisit: (input) => idFormats.buildSiteVisitCode(input),
  activity: (input) => idFormats.buildActivityCode(input),
  checklist: (input) => idFormats.buildChecklistId(input),
  finding: (input) => idFormats.buildFindingId(input),
  correctiveAction: (input) =>
    idFormats.buildCapIdFromFinding({ findingId: input.findingId, capSequence: input.sequence }),
  followUp: (input) =>
    idFormats.buildFollowUpIdFromFinding({ findingId: input.findingId, followUpSequence: input.sequence }),
};

describe('domain-rule conformance', () => {
  it('compiles every server pattern from the spec, verbatim', () => {
    for (const [id, exportName] of Object.entries(PATTERN_EXPORTS)) {
      expect(idFormats[exportName].source).toBe(domainSpec.ids[id].pattern);
    }
  });

  it('parses every valid vector identically on the server', () => {
    for (const vector of domainSpec.conformanceVectors.parse) {
      expect(PARSERS[vector.id](vector.value), `${vector.id} ${vector.value}`).toEqual(vector.expected);
    }
  });

  it('rejects every invalid vector on the server', () => {
    for (const vector of domainSpec.conformanceVectors.invalid) {
      expect(PARSERS[vector.id](vector.value), `${vector.id} ${vector.value}`).toBeNull();
    }
  });

  it('builds every vector identically on the server', () => {
    for (const vector of domainSpec.conformanceVectors.build) {
      expect(BUILDERS[vector.id](vector.input), vector.id).toBe(vector.expected);
    }
  });

  it('keeps the client id helpers in lockstep with the spec', () => {
    for (const vector of domainSpec.conformanceVectors.parse) {
      if (vector.id === 'siteVisit') {
        expect(parseSiteVisitCodeClient(vector.value)).toEqual(vector.expected);
      }
      if (vector.id === 'activity') {
        expect(parseActivityCodeClient(vector.value)).toEqual(vector.expected);
      }
    }

    for (const vector of domainSpec.conformanceVectors.build) {
      if (vector.id === 'siteVisit') {
        expect(buildSiteVisitCodeClient(vector.input)).toBe(vector.expected);
      }
      if (vector.id === 'activity') {
        expect(buildActivityCodeClient(vector.input)).toBe(vector.expected);
      }
    }

    for (const vector of domainSpec.conformanceVectors.invalid) {
      if (vector.id === 'siteVisit') {
        expect(parseSiteVisitCodeClient(vector.value)).toBeNull();
      }
      if (vector.id === 'activity') {
        expect(parseActivityCodeClient(vector.value)).toBeNull();
      }
    }
  });

  it('computes the spec severity deadlines from the live FindingSeverity record', async () => {
    for (const vector of domainSpec.conformanceVectors.severity) {
      const nodeRedClient = {
        queryEntity: async ({ entity, data }) =>
          entity === 'FindingSeverity'
            ? {
                list: [
                  {
                    name: data.name,
                    daysToSolution: vector.daysToSolution,
                    daysToSubmission: vector.daysToSolution,
                  },
                ],
              }
            : { list: [] },
      };

      const result = await computeDeadlinesForSeverity({
        nodeRedClient,
        ticket: 'conformance-ticket',
        findingSeverity: vector.severity,
        baseDate: new Date(`${vector.baseDate}T12:00:00.000Z`),
      });

      expect(result.resolutionDeadline, `severity ${vector.severity}`).toBe(vector.resolutionDeadline);
    }
  });

  it('carries the severity levels the checklist and import copies assume', () => {
    expect(domainSpec.severity.levels.map((level) => [level.id, level.daysToSolution])).toEqual([
      ['A', 7],
      ['B', 30],
      ['C', 90],
    ]);
  });
});
