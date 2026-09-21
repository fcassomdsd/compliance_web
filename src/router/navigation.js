// The application's primary navigation, in the order it is shown.
//
// One ordered list serves two purposes, so the two never disagree:
//   - App.vue renders the nav from it, dropping the entries the session's roles
//     do not allow;
//   - HomeView.vue lands the user on the first entry they are allowed, which is
//     what stops a reporter or a cap_entry user from being bounced to
//     /forbidden straight after login.
//
// The role lists themselves stay in `router/index.js` as each route's
// `meta.requiredRoles` — they are read back from the route record here rather
// than copied, so the guard, the nav and the landing page all enforce the same
// arrays.

export const NAV_ITEMS = [
  { name: 'oversightPosture', labelKey: 'app.nav.oversightPosture' },
  { name: 'siteVisit', labelKey: 'app.nav.siteVisits' },
  { name: 'assignInspectors', labelKey: 'app.nav.assignInspectors' },
  { name: 'checklist', labelKey: 'app.nav.inspectionChecklist' },
  { name: 'inspectionPlan', labelKey: 'app.nav.inspectionPlan' },
  { name: 'inspectionReport', labelKey: 'app.nav.inspectionReport' },
  { name: 'findings', labelKey: 'app.nav.findings' },
  { name: 'correctiveActions', labelKey: 'app.nav.correctiveActions' },
  { name: 'followUps', labelKey: 'app.nav.followUps' },
  { name: 'inspectionCadences', labelKey: 'app.nav.inspectionCadences' },
  { name: 'providerHistory', labelKey: 'app.nav.providerHistory' },
  { name: 'usoapEvidenceReport', labelKey: 'app.nav.usoapEvidenceReport' },
];

// Where a user with no role-gated destination goes: /notifications carries no
// role gate, so every authenticated session can reach it.
export const FALLBACK_ROUTE_NAME = 'notifications';

function routeRecordFor(router, routeName) {
  return router.getRoutes().find((route) => route.name === routeName) ?? null;
}

// The roles a named route requires, read off the live route record. A route with
// no `requiredRoles` — or one this router does not carry — returns [].
export function requiredRolesFor(router, routeName) {
  return routeRecordFor(router, routeName)?.meta?.requiredRoles ?? [];
}

// The nav entries this session may actually open, in order. `hasRole` is the
// auth store's getter — the same any-role match the router guard uses. An entry
// whose route the router does not carry is dropped rather than rendered into a
// link that cannot resolve.
export function permittedNavItems(router, hasRole) {
  return NAV_ITEMS.filter((item) => {
    const record = routeRecordFor(router, item.name);
    if (!record) return false;
    const required = record.meta?.requiredRoles ?? [];
    return required.length === 0 || hasRole(required);
  });
}

// The first nav entry this session may open, or the fallback when there is none.
export function landingRouteName(router, hasRole) {
  return permittedNavItems(router, hasRole)[0]?.name ?? FALLBACK_ROUTE_NAME;
}
