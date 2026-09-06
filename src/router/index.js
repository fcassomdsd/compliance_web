import { createRouter, createWebHistory } from 'vue-router';
import { applyAuthGuards } from '@/router/guards';

const routes = [
  {
    path: '/',
    name: 'home',
    // Role-aware landing page: inspectors land on the oversight posture
    // dashboard, everyone else keeps the previous default. Deciding this
    // inside HomeView.vue (rather than a static redirect string) means the
    // auth guard has already refreshed authStore.roles before we choose.
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/oversight-posture',
    name: 'oversightPosture',
    component: () => import('@/views/OversightPostureDashboard.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'planner', 'reporter', 'admin'] },
  },
  {
    path: '/site-visit',
    name: 'siteVisit',
    component: () => import('@/views/SiteVisitManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['planner', 'admin'] },
  },
  {
    path: '/site-visit/:siteVisitId/provider/:providerId',
    name: 'providerInspection',
    component: () => import('@/views/InspectionManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['planner', 'admin'] },
  },
  {
    path: '/assign-inspectors',
    name: 'assignInspectors',
    component: () => import('@/views/AssignInspectors.vue'),
    meta: { requiresAuth: true, requiredRoles: ['assigner', 'admin'] },
  },
  {
    path: '/checklist',
    name: 'checklist',
    component: () => import('@/views/ChecklistManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'admin'] },
  },
  {
    path: '/inspection-plan',
    name: 'inspectionPlan',
    component: () => import('@/views/InspectionPlan.vue'),
    meta: { requiresAuth: true, requiredRoles: ['planner', 'inspector', 'admin'] },
  },
  {
    path: '/inspection-report',
    name: 'inspectionReport',
    component: () => import('@/views/InspectionReport.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'admin'] },
  },
  {
    path: '/findings',
    name: 'findings',
    component: () => import('@/views/FindingManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'planner', 'cap_entry', 'admin'] },
  },
  {
    path: '/corrective-actions',
    name: 'correctiveActions',
    component: () => import('@/views/CorrectiveActionManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'planner', 'cap_entry', 'admin'] },
  },
  {
    path: '/follow-ups',
    name: 'followUps',
    component: () => import('@/views/FollowUpManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'planner', 'cap_entry', 'admin'] },
  },
  {
    path: '/provider-history',
    name: 'providerHistory',
    component: () => import('@/views/ProviderHistoryLookup.vue'),
    meta: { requiresAuth: true, requiredRoles: ['inspector', 'planner', 'reporter', 'admin'] },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/views/NotificationCenter.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/inspection-cadences',
    name: 'inspectionCadences',
    component: () => import('@/views/InspectionCadenceManager.vue'),
    meta: { requiresAuth: true, requiredRoles: ['planner', 'admin'] },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: () => import('@/views/ForbiddenView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { requiresAuth: false },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

applyAuthGuards(router);

export default router;
