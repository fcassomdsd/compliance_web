import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

import App from '@/App.vue';
import { useAuthStore } from '@/stores/authStore';

// Mirrors the real route table (src/router/index.js): the nav is rendered from
// route *names* and filtered by each route's own `meta.requiredRoles`, so a stub
// table without those two things no longer exercises App.vue.
function page(id) {
  return { template: `<div id="${id}">${id}</div>` };
}

const routes = [
  { path: '/', redirect: '/oversight-posture' },
  {
    path: '/oversight-posture',
    name: 'oversightPosture',
    component: page('oversight-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'reporter', 'admin'] },
  },
  {
    path: '/site-visit',
    name: 'siteVisit',
    component: page('site-visit-page'),
    meta: { requiredRoles: ['planner', 'admin'] },
  },
  {
    path: '/assign-inspectors',
    name: 'assignInspectors',
    component: page('assign-page'),
    meta: { requiredRoles: ['assigner', 'admin'] },
  },
  {
    path: '/checklist',
    name: 'checklist',
    component: page('checklist-page'),
    meta: { requiredRoles: ['inspector', 'admin'] },
  },
  {
    path: '/inspection-plan',
    name: 'inspectionPlan',
    component: page('plan-page'),
    meta: { requiredRoles: ['planner', 'inspector', 'admin'] },
  },
  {
    path: '/inspection-report',
    name: 'inspectionReport',
    component: page('report-page'),
    meta: { requiredRoles: ['inspector', 'admin'] },
  },
  {
    path: '/findings',
    name: 'findings',
    component: page('findings-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'cap_entry', 'closure_reviewer', 'admin'] },
  },
  {
    path: '/corrective-actions',
    name: 'correctiveActions',
    component: page('caps-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'cap_entry', 'admin'] },
  },
  {
    path: '/follow-ups',
    name: 'followUps',
    component: page('follow-ups-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'cap_entry', 'admin'] },
  },
  {
    path: '/inspection-cadences',
    name: 'inspectionCadences',
    component: page('cadences-page'),
    meta: { requiredRoles: ['planner', 'admin'] },
  },
  {
    path: '/provider-history',
    name: 'providerHistory',
    component: page('provider-history-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'reporter', 'admin'] },
  },
  {
    path: '/usoap-evidence-report',
    name: 'usoapEvidenceReport',
    component: page('usoap-page'),
    meta: { requiredRoles: ['inspector', 'planner', 'reporter', 'admin'] },
  },
  { path: '/notifications', name: 'notifications', component: page('notifications-page') },
  { path: '/login', name: 'login', component: page('login-page') },
  { path: '/:pathMatch(.*)*', component: page('not-found-page') },
];

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

// `admin` by default so the tests that are not about role filtering see the
// whole nav, the way every user used to.
async function mountAppAt(path = '/oversight-posture', roles = ['admin']) {
  const router = createTestRouter();
  const pinia = createPinia();
  const authStore = useAuthStore(pinia);
  authStore.roles = roles;

  router.push(path);
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
    },
  });

  return { wrapper, router, authStore };
}

function navLabels(wrapper) {
  return wrapper.findAll('a.nav-link').map((link) => link.text().trim());
}

describe('App.vue (router navigation)', () => {
  beforeEach(() => {
    // no-op for now; test isolation is handled by fresh router instances
  });

  it('renders header title and logo', async () => {
    const { wrapper } = await mountAppAt();

    expect(wrapper.find('.header').exists()).toBe(true);
    expect(wrapper.find('h2').text()).toBe('Operational Safety Compliance System');

    const logo = wrapper.find('img');
    expect(logo.exists()).toBe(true);
    expect(logo.attributes('src')).toContain('compliance-logo');
  });

  it('renders navigation links', async () => {
    const { wrapper } = await mountAppAt();

    const links = wrapper.findAll('a.nav-link');
    expect(links).toHaveLength(12);

    const labels = links.map((link) => link.text().trim());
    expect(labels).toEqual([
      'Oversight Posture',
      'Site Visits',
      'Assign Inspectors',
      'Inspection Checklist',
      'Inspection Plan',
      'Inspection Report',
      'Findings',
      'Corrective Actions',
      'Follow-ups',
      'Inspection Cadences',
      'Provider History',
      'USOAP Evidence Report',
    ]);
  });

  it('offers only the links a role may actually open', async () => {
    const { wrapper } = await mountAppAt('/corrective-actions', ['cap_entry']);

    expect(navLabels(wrapper)).toEqual(['Findings', 'Corrective Actions', 'Follow-ups']);
  });

  it('offers a reporter its reports and nothing else', async () => {
    const { wrapper } = await mountAppAt('/oversight-posture', ['reporter']);

    expect(navLabels(wrapper)).toEqual([
      'Oversight Posture',
      'Provider History',
      'USOAP Evidence Report',
    ]);
  });

  it('offers a planner and an inspector the union of what either may open', async () => {
    const { wrapper } = await mountAppAt('/oversight-posture', ['inspector', 'planner']);

    expect(navLabels(wrapper)).toEqual([
      'Oversight Posture',
      'Site Visits',
      'Inspection Checklist',
      'Inspection Plan',
      'Inspection Report',
      'Findings',
      'Corrective Actions',
      'Follow-ups',
      'Inspection Cadences',
      'Provider History',
      'USOAP Evidence Report',
    ]);
  });

  it('offers nothing to a session whose groups map to no role', async () => {
    const { wrapper } = await mountAppAt('/notifications', []);

    expect(navLabels(wrapper)).toEqual([]);
  });

  it('loads the landing route content by default', async () => {
    const { wrapper } = await mountAppAt('/');

    expect(wrapper.find('#oversight-page').exists()).toBe(true);
  });

  it('navigates to checklist route and renders its content', async () => {
    const { wrapper, router } = await mountAppAt('/oversight-posture');

    await router.push('/checklist');
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.path).toBe('/checklist');
    expect(wrapper.find('#checklist-page').exists()).toBe(true);
  });

  it('applies active-view class to the active route link', async () => {
    const { wrapper } = await mountAppAt('/assign-inspectors');

    const links = wrapper.findAll('a.nav-link');
    const activeLink = links.find((link) => link.classes().includes('active-view'));

    expect(activeLink).toBeDefined();
    expect(activeLink.text()).toContain('Assign Inspectors');
  });

  it('renders not-found route for unknown paths', async () => {
    const { wrapper } = await mountAppAt('/some/unknown/path');

    expect(wrapper.find('#not-found-page').exists()).toBe(true);
  });

  it('hides logout control when user is not authenticated', async () => {
    const { wrapper } = await mountAppAt('/site-visit');

    expect(wrapper.find('.signed-in-user').exists()).toBe(false);
  });

  it('shows logout control for authenticated user and redirects to login on sign out', async () => {
    const router = createTestRouter();
    const pinia = createPinia();
    const authStore = useAuthStore(pinia);
    authStore.authenticated = true;
    authStore.user = { username: 'fernando.casso' };
    const logoutSpy = vi.spyOn(authStore, 'logout').mockResolvedValue(true);
    const pushSpy = vi.spyOn(router, 'push');

    router.push('/oversight-posture');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, router],
      },
    });

    expect(wrapper.find('.signed-in-user').text()).toContain('fernando.casso');
    const logoutButton = wrapper.find('.btn-danger');
    expect(logoutButton.exists()).toBe(true);

    await logoutButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith({ name: 'login' });
  });

  it('periodically keeps the session alive for an authenticated user, independent of navigation', async () => {
    vi.useFakeTimers();
    try {
      const router = createTestRouter();
      const pinia = createPinia();
      const authStore = useAuthStore(pinia);
      authStore.authenticated = true;
      authStore.user = { username: 'fernando.casso' };
      const ensureSessionFreshSpy = vi.spyOn(authStore, 'ensureSessionFresh').mockResolvedValue(true);

      router.push('/oversight-posture');
      await router.isReady();

      mount(App, {
        global: {
          plugins: [pinia, router],
        },
      });

      expect(ensureSessionFreshSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(ensureSessionFreshSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(ensureSessionFreshSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not poll the session for an unauthenticated user', async () => {
    vi.useFakeTimers();
    try {
      const router = createTestRouter();
      const pinia = createPinia();
      const authStore = useAuthStore(pinia);
      const ensureSessionFreshSpy = vi.spyOn(authStore, 'ensureSessionFresh').mockResolvedValue(false);

      router.push('/login');
      await router.isReady();

      mount(App, {
        global: {
          plugins: [pinia, router],
        },
      });

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(ensureSessionFreshSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
