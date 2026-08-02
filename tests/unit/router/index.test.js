import { describe, it, expect, vi, beforeEach } from 'vitest';

const applyAuthGuards = vi.fn();

vi.mock('@/router/guards', () => ({
  applyAuthGuards,
}));

describe('router index', () => {
  beforeEach(() => {
    vi.resetModules();
    applyAuthGuards.mockClear();
  });

  it('registers routes with expected role metadata and applies guards', async () => {
    const { default: router } = await import('@/router/index.js');

    expect(applyAuthGuards).toHaveBeenCalledWith(router);

    const siteVisit = router.getRoutes().find((route) => route.name === 'siteVisit');
    const providerInspection = router.getRoutes().find((route) => route.name === 'providerInspection');
    const assignInspectors = router.getRoutes().find((route) => route.name === 'assignInspectors');
    const checklist = router.getRoutes().find((route) => route.name === 'checklist');
    const inspectionPlan = router.getRoutes().find((route) => route.name === 'inspectionPlan');
    const inspectionReport = router.getRoutes().find((route) => route.name === 'inspectionReport');
    const followUps = router.getRoutes().find((route) => route.name === 'followUps');

    expect(siteVisit.meta.requiredRoles).toEqual(['planner', 'admin']);
    expect(providerInspection.meta.requiredRoles).toEqual(['planner', 'admin']);
    expect(assignInspectors.meta.requiredRoles).toEqual(['assigner', 'admin']);
    expect(checklist.meta.requiredRoles).toEqual(['inspector', 'admin']);
    expect(inspectionPlan.meta.requiredRoles).toEqual(['planner', 'inspector', 'admin']);
    expect(inspectionReport.meta.requiredRoles).toEqual(['inspector', 'admin']);
    expect(followUps.meta.requiredRoles).toEqual(['inspector', 'planner', 'cap_entry', 'admin']);
  });

  it('executes lazy route component factories', async () => {
    const { default: router } = await import('@/router/index.js');

    const lazyRoutes = router
      .getRoutes()
      .filter((route) => route.components?.default && typeof route.components.default === 'function');

    const loaded = await Promise.all(lazyRoutes.map((route) => route.components.default()));

    expect(loaded).toHaveLength(lazyRoutes.length);
    loaded.forEach((module) => {
      expect(module).toBeTruthy();
      expect(module.default).toBeTruthy();
    });
  });
});