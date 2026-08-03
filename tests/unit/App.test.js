import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

import App from '@/App.vue';
import { useAuthStore } from '@/stores/authStore';

const routes = [
  { path: '/', redirect: '/inspection' },
  { path: '/inspection', component: { template: '<div id="inspection-page">Inspection</div>' } },
  { path: '/assign-inspectors', component: { template: '<div id="assign-page">Assign</div>' } },
  { path: '/checklist', component: { template: '<div id="checklist-page">Checklist</div>' } },
  { path: '/inspection-plan', component: { template: '<div id="plan-page">Plan</div>' } },
  { path: '/inspection-report', component: { template: '<div id="report-page">Report</div>' } },
  { path: '/follow-ups', component: { template: '<div id="follow-ups-page">Follow-ups</div>' } },
  { path: '/login', name: 'login', component: { template: '<div id="login-page">Login</div>' } },
  { path: '/:pathMatch(.*)*', component: { template: '<div id="not-found-page">Not Found</div>' } },
];

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

async function mountAppAt(path = '/inspection') {
  const router = createTestRouter();
  const pinia = createPinia();

  router.push(path);
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router],
    },
  });

  return { wrapper, router };
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
    expect(links).toHaveLength(8);

    const labels = links.map((link) => link.text().trim());
    expect(labels).toEqual([
      'Site Visits',
      'Assign Inspectors',
      'Inspection Checklist',
      'Inspection Plan',
      'Inspection Report',
      'Findings',
      'Corrective Actions',
      'Follow-ups',
    ]);
  });

  it('loads inspection route content by default', async () => {
    const { wrapper } = await mountAppAt('/');

    expect(wrapper.find('#inspection-page').exists()).toBe(true);
  });

  it('navigates to checklist route and renders its content', async () => {
    const { wrapper, router } = await mountAppAt('/inspection');

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

    router.push('/inspection');
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
});
