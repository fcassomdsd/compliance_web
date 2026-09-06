import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  FINDING_STATUS,
  computeEffectiveFindingStatus,
  canSubmitCap,
  resolveFindingStatusFromFollowUp,
} = require('../../server/domain/statusRules.cjs');

const NOW = new Date('2026-04-03T10:00:00.000Z');
const PAST_DEADLINE = '2026-04-01';
const FUTURE_DEADLINE = '2026-05-01';

function baseFinding(overrides = {}) {
  return {
    findingStatus: FINDING_STATUS.OPEN,
    submissionDeadline: FUTURE_DEADLINE,
    resolutionDeadline: FUTURE_DEADLINE,
    ...overrides,
  };
}

describe('computeEffectiveFindingStatus - overdue matrix', () => {
  it('none overdue: both deadlines in the future', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding(),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.OPEN);
    expect(result.capOverdue).toBe(false);
    expect(result.solutionOverdueEvidence).toBe('none');
    expect(result.statusDivergence).toBe(false);
  });

  it('CAP overdue only: submissionDeadline passed, resolutionDeadline in the future, no CAP submitted yet', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({ submissionDeadline: PAST_DEADLINE }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.CAP_OVERDUE);
    expect(result.capOverdue).toBe(true);
    expect(result.solutionOverdueEvidence).toBe('none');
    expect(result.statusDivergence).toBe(true);
  });

  it('Solution overdue only: resolutionDeadline passed, submissionDeadline in the future', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({ resolutionDeadline: PAST_DEADLINE }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.SOLUTION_OVERDUE);
    expect(result.capOverdue).toBe(false);
    expect(result.solutionOverdueEvidence).toBe('assumed');
    expect(result.statusDivergence).toBe(true);
  });

  it('both overdue: submissionDeadline and resolutionDeadline both passed, Solution Overdue wins but capOverdue flag stays true', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({ submissionDeadline: PAST_DEADLINE, resolutionDeadline: PAST_DEADLINE }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.SOLUTION_OVERDUE);
    expect(result.capOverdue).toBe(true);
    expect(result.solutionOverdueEvidence).toBe('assumed');
    expect(result.statusDivergence).toBe(true);
  });

  it('Solution overdue applies even after a CAP has been submitted (storedStatus not Open)', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({
        findingStatus: FINDING_STATUS.CAP_ACCEPTED,
        submissionDeadline: PAST_DEADLINE,
        resolutionDeadline: PAST_DEADLINE,
      }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.SOLUTION_OVERDUE);
    // CAP was already submitted/accepted, so submissionDeadline no longer matters.
    expect(result.capOverdue).toBe(false);
  });

  it('CAP overdue never applies once storedStatus has moved past Open, even if submissionDeadline passed', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({
        findingStatus: FINDING_STATUS.CAP_ACCEPTED,
        submissionDeadline: PAST_DEADLINE,
      }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.CAP_ACCEPTED);
    expect(result.capOverdue).toBe(false);
    expect(result.statusDivergence).toBe(false);
  });

  it('a closed finding is never flagged overdue, regardless of both deadlines', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({
        findingStatus: FINDING_STATUS.CLOSED,
        submissionDeadline: PAST_DEADLINE,
        resolutionDeadline: PAST_DEADLINE,
      }),
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.CLOSED);
    expect(result.capOverdue).toBe(false);
    expect(result.solutionOverdueEvidence).toBe('none');
  });

  it('a finding closed via confirmed follow-up effectiveness is never flagged overdue', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({ submissionDeadline: PAST_DEADLINE, resolutionDeadline: PAST_DEADLINE }),
      followUpReports: [{ followUpDate: '2026-04-02', findingClosed: true, effectivenessConfirmed: true }],
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.OPEN);
    expect(result.capOverdue).toBe(false);
    expect(result.solutionOverdueEvidence).toBe('none');
  });

  it('confirmed overdue evidence: a follow-up after the resolutionDeadline without confirmed closure', () => {
    const result = computeEffectiveFindingStatus({
      finding: baseFinding({ resolutionDeadline: PAST_DEADLINE }),
      followUpReports: [{ followUpDate: '2026-04-02', findingClosed: false, effectivenessConfirmed: false }],
      now: NOW,
    });

    expect(result.effectiveStatus).toBe(FINDING_STATUS.SOLUTION_OVERDUE);
    expect(result.solutionOverdueEvidence).toBe('confirmed');
  });
});

describe('canSubmitCap', () => {
  it('allows submission when Open', () => {
    expect(canSubmitCap(FINDING_STATUS.OPEN)).toBe(true);
  });

  it('allows submission when CAP Overdue', () => {
    expect(canSubmitCap(FINDING_STATUS.CAP_OVERDUE)).toBe(true);
  });

  it('disallows submission when Solution Overdue', () => {
    expect(canSubmitCap(FINDING_STATUS.SOLUTION_OVERDUE)).toBe(false);
  });

  it('disallows submission once a CAP stage has been reached', () => {
    expect(canSubmitCap(FINDING_STATUS.CAP_SUBMITTED)).toBe(false);
    expect(canSubmitCap(FINDING_STATUS.CAP_ACCEPTED)).toBe(false);
    expect(canSubmitCap(FINDING_STATUS.CLOSED)).toBe(false);
  });
});

describe('resolveFindingStatusFromFollowUp', () => {
  it('resolves to Pending Closure Approval for a valid closure verification', () => {
    const status = resolveFindingStatusFromFollowUp({
      followUpType: 'Closure Verification',
      effectivenessConfirmed: true,
      percentComplete: 100,
    });
    expect(status).toBe(FINDING_STATUS.PENDING_CLOSURE_APPROVAL);
  });

  it('does not resolve to closure approval when effectivenessConfirmed is false, even with the right type', () => {
    const status = resolveFindingStatusFromFollowUp({
      followUpType: 'Closure Verification',
      effectivenessConfirmed: false,
      percentComplete: 100,
    });
    expect(status).toBe(FINDING_STATUS.PENDING_CLOSURE_REVIEW);
  });

  it('does not resolve to closure approval for a different follow-up type, even with effectivenessConfirmed', () => {
    const status = resolveFindingStatusFromFollowUp({
      followUpType: 'Progress Review',
      effectivenessConfirmed: true,
      percentComplete: 100,
    });
    expect(status).toBe(FINDING_STATUS.PENDING_CLOSURE_REVIEW);
  });

  it('resolves to Pending Closure Review at 100% without a closure attempt', () => {
    const status = resolveFindingStatusFromFollowUp({
      followUpType: 'Progress Review',
      effectivenessConfirmed: false,
      percentComplete: 100,
    });
    expect(status).toBe(FINDING_STATUS.PENDING_CLOSURE_REVIEW);
  });

  it('resolves to In Progress below 100% completion', () => {
    const status = resolveFindingStatusFromFollowUp({
      followUpType: 'Progress Review',
      effectivenessConfirmed: false,
      percentComplete: 40,
    });
    expect(status).toBe(FINDING_STATUS.IN_PROGRESS);
  });
});
