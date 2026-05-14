import { createRouter, createWebHistory } from 'vue-router';
import { applyAuthGuards } from '@/router/guards';

const routes = [
  {
    path: '/',
    redirect: '/inspection',
  },
  {
    path: '/inspection',
    name: 'inspection',
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
