import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

import LoginView from '@/views/LoginView.vue';
import ForbiddenView from '@/views/ForbiddenView.vue';
import NotFound from '@/views/NotFound.vue';

const routeState = { query: {} };
const routerPush = vi.fn();
const authStore = {
  loading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: routerPush }),
  RouterLink: {
    props: ['to'],
    template: `<a :href="typeof to === 'string' ? to : to.path"><slot /></a>`,
  },
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => authStore,
}));

describe('auth-facing views', () => {
  beforeEach(() => {
    routeState.query = {};
    authStore.loading = false;
    authStore.error = null;
    authStore.login.mockReset();
    authStore.logout.mockReset();
    routerPush.mockReset();
  });

  it('LoginView shows default and expired messages', async () => {
    const wrapper = mount(LoginView);
    expect(wrapper.text()).toContain('You must sign in to access this page.');

    routeState.query = { reason: 'expired' };
    const expiredWrapper = mount(LoginView);
    expect(expiredWrapper.text()).toContain('Your session expired. Please sign in again.');
  });

  it('LoginView submits credentials and redirects', async () => {
    authStore.login.mockResolvedValueOnce(true);
    routeState.query = { redirect: '/inspection-report' };
    const wrapper = mount(LoginView);

    await wrapper.find('input[type="text"]').setValue('fernando.casso');
    await wrapper.find('input[type="password"]').setValue('secret');
    await wrapper.find('form').trigger('submit.prevent');

    expect(authStore.login).toHaveBeenCalledWith('fernando.casso', 'secret');
    expect(routerPush).toHaveBeenCalledWith('/inspection-report');
  });

  it('LoginView renders auth error and keeps navigation on failed login', async () => {
    authStore.error = 'Bad credentials';
    authStore.login.mockRejectedValueOnce(new Error('Bad credentials'));
    const wrapper = mount(LoginView);

    await wrapper.find('input[type="text"]').setValue('fernando.casso');
    await wrapper.find('input[type="password"]').setValue('bad');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.text()).toContain('Bad credentials');
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('ForbiddenView signs out and redirects to login', async () => {
    authStore.logout.mockResolvedValueOnce(true);
    const wrapper = mount(ForbiddenView, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a href="/inspection"><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('button').trigger('click');

    expect(authStore.logout).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith({ name: 'login' });
  });

  it('NotFound renders recovery navigation', () => {
    const wrapper = mount(NotFound, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a href="/inspection"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Page not found');
    expect(wrapper.text()).toContain('Go to Inspection Manager');
  });
});