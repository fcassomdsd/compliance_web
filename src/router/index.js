import { createRouter, createWebHistory } from 'vue-router';

function requiresAuth(route) {
  return route.matched.some((record) => record.meta?.requiresAuth);
}

function isAuthenticated() {
  // Minimal scaffold: this can later read from Pinia/auth service/token storage.
  return true;
}

const routes = [
  {
    path: '/',
    redirect: '/inspection',
  },
  {
    path: '/inspection',
    name: 'inspection',
    component: () => import('@/views/InspectionManager.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/assign-inspectors',
    name: 'assignInspectors',
    component: () => import('@/views/AssignInspectors.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/checklist',
    name: 'checklist',
    component: () => import('@/views/ChecklistManager.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/inspection-plan',
    name: 'inspectionPlan',
    component: () => import('@/views/InspectionPlan.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/inspection-report',
    name: 'inspectionReport',
    component: () => import('@/views/InspectionReport.vue'),
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

router.beforeEach((to) => {
  if (requiresAuth(to) && !isAuthenticated()) {
    return { name: 'inspection' };
  }

  return true;
});

export default router;
