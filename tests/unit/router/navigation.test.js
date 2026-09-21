import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';

import router from '@/router';
import { NAV_ITEMS, permittedNavItems, landingRouteName, requiredRolesFor } from '@/router/navigation';

// The any-role match the auth store's getter and the route guard both use.
function hasRoleFor(roles) {
  const held = new Set(roles.map((role) => String(role).trim().toLowerCase()));
  return (required) => (Array.isArray(required) ? required : [required])
    .some((role) => held.has(String(role).trim().toLowerCase()));
}

const names = (items) => items.map((item) => item.name);

describe('navigation manifest', () => {
  it('names only routes the real router carries', () => {
    const known = new Set(router.getRoutes().map((route) => route.name));

    for (const item of NAV_ITEMS) {
      expect(known.has(item.name)).toBe(true);
    }
  });

  it('reads each route\'s roles from the route record, not a second copy', () => {
    expect(requiredRolesFor(router, 'assignInspectors')).toEqual(['assigner', 'admin']);
    expect(requiredRolesFor(router, 'siteVisit')).toEqual(['planner', 'admin']);
    // A route this router does not carry has no role gate to report.
    expect(requiredRolesFor(router, 'nonexistent')).toEqual([]);
  });

  it('offers an admin every entry', () => {
    expect(permittedNavItems(router, hasRoleFor(['admin']))).toHaveLength(NAV_ITEMS.length);
  });

  it('offers each role only what it may open', () => {
    expect(names(permittedNavItems(router, hasRoleFor(['cap_entry']))))
      .toEqual(['findings', 'correctiveActions', 'followUps']);
    expect(names(permittedNavItems(router, hasRoleFor(['closure_reviewer']))))
      .toEqual(['findings']);
    expect(names(permittedNavItems(router, hasRoleFor(['assigner']))))
      .toEqual(['assignInspectors']);
    expect(names(permittedNavItems(router, hasRoleFor(['reporter']))))
      .toEqual(['oversightPosture', 'providerHistory', 'usoapEvidenceReport']);
  });

  it('drops entries whose route the router does not carry', () => {
    const partial = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/findings', name: 'findings', component: { template: '<div />' } }],
    });

    expect(names(permittedNavItems(partial, () => true))).toEqual(['findings']);
  });
});

describe('landing route', () => {
  it.each([
    [['admin'], 'oversightPosture'],
    [['inspector'], 'oversightPosture'],
    [['planner'], 'oversightPosture'],
    [['reporter'], 'oversightPosture'],
    [['assigner'], 'assignInspectors'],
    [['cap_entry'], 'findings'],
    [['closure_reviewer'], 'findings'],
  ])('sends %s to the first route it may open', (roles, expected) => {
    expect(landingRouteName(router, hasRoleFor(roles))).toBe(expected);
  });

  // Every gated destination is refused, so land somewhere that is not /forbidden.
  it('falls back to notifications when no navigation entry is permitted', () => {
    expect(landingRouteName(router, hasRoleFor([]))).toBe('notifications');
  });
});
