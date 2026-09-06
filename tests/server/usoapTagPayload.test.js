import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildDerivedUsoapTagPayload, buildCapUsoapTagPayloadFromFinding } = require('../../server/domain/usoapTagPayload.cjs');

describe('buildDerivedUsoapTagPayload', () => {
  it('returns no aspects/properties when nothing is tagged', () => {
    expect(buildDerivedUsoapTagPayload({})).toEqual({ aspectNames: [], properties: {} });
  });

  it('adds only vso:usoapEvidenceContext when ceMapping/areaMapping are absent', () => {
    const result = buildDerivedUsoapTagPayload({ criticalElement: 'CE-8', pqReferences: ['PQ 8.048'] });
    expect(result.aspectNames).toEqual(['vso:usoapEvidenceContext']);
    expect(result.properties).toEqual({
      'vso:usoapCriticalElement': 'CE-8',
      'vso:usoapPqReference': ['PQ 8.048'],
      'vso:usoapTagSource': 'Derived',
    });
  });

  it('adds vso:regulatoryTraceability too when ceMapping/areaMapping are present', () => {
    const result = buildDerivedUsoapTagPayload({
      criticalElement: 'CE-8',
      areaCode: 'AGA',
      pqReferences: ['PQ 8.048'],
      ceMapping: ['CE-8'],
      areaMapping: ['AGA'],
    });
    expect(result.aspectNames).toEqual(['vso:usoapEvidenceContext', 'vso:regulatoryTraceability']);
    expect(result.properties).toEqual({
      'vso:usoapCriticalElement': 'CE-8',
      'vso:usoapAreaCode': 'AGA',
      'vso:usoapPqReference': ['PQ 8.048'],
      'vso:ceMapping': ['CE-8'],
      'vso:areaMapping': ['AGA'],
      'vso:usoapTagSource': 'Derived',
    });
  });
});

describe('buildCapUsoapTagPayloadFromFinding', () => {
  it('copies the finding tag fields verbatim', () => {
    const finding = {
      usoapCriticalElement: 'CE-6',
      usoapAreaCode: 'AGA',
      usoapPqReference: ['PQ 8.111'],
      ceMapping: ['CE-6'],
      areaMapping: ['AGA'],
      usoapTagSource: 'Chain-derived',
    };
    const result = buildCapUsoapTagPayloadFromFinding(finding);
    expect(result.properties['vso:usoapPqReference']).toEqual(['PQ 8.111']);
    // Always writes "Derived", regardless of the source finding's own tagSource.
    expect(result.properties['vso:usoapTagSource']).toBe('Derived');
  });

  it('returns an empty payload when the finding has no tags', () => {
    expect(buildCapUsoapTagPayloadFromFinding({})).toEqual({ aspectNames: [], properties: {} });
    expect(buildCapUsoapTagPayloadFromFinding(undefined)).toEqual({ aspectNames: [], properties: {} });
  });
});
