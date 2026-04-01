import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/authStore';
import { requireAuth, requireRole } from '@/router/guards';

function buildRoute({ requiresAuth = false, requiredRoles = [], fullPath = '/inspection' } = {}) {
  return {
    fullPath,
    matched: [
      {
        meta: {
          requiresAuth,
          requiredRoles,
        },
      },
    ],
  };
}

describe('router guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('requireAuth allows public routes', async () => {
    const store = useAuthStore();
    store.initialized = false;

    const result = await requireAuth(buildRoute({ requiresAuth: false, fullPath: '/login' }), store);
    expect(result).toBe(true);
  });

  it('requireAuth redirects anonymous users to login', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = false;

    const result = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/inspection' }), store);
    expect(result).toEqual({
      name: 'login',
      query: { redirect: '/inspection' },
    });
  });

  it('requireAuth allows authenticated users', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;

    const result = await requireAuth(buildRoute({ requiresAuth: true }), store);
    expect(result).toBe(true);
  });

  it('requireRole allows any-role match', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    store.roles = ['planner'];

    const result = await requireRole(
      buildRoute({
        requiresAuth: true,
        requiredRoles: ['inspector', 'planner'],
        fullPath: '/assign-inspectors',
      }),
      store
    );

    expect(result).toBe(true);
  });

  it('requireRole redirects to forbidden when no required role matches', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    store.roles = ['inspector'];

    const result = await requireRole(
      buildRoute({
        requiresAuth: true,
        requiredRoles: ['reporter'],
        fullPath: '/inspection-report',
      }),
      store
    );

    expect(result).toEqual({ name: 'forbidden' });
  });

  it('requireRole redirects unauthenticated users to login', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = false;

    const result = await requireRole(
      buildRoute({
        requiresAuth: true,
        requiredRoles: ['admin'],
        fullPath: '/inspection-plan',
      }),
      store
    );

    expect(result).toEqual({
      name: 'login',
      query: { redirect: '/inspection-plan' },
    });
  });

  it('initializes auth store on first protected navigation', async () => {
    const store = useAuthStore();
    store.initialized = false;
    const initSpy = vi.spyOn(store, 'init').mockImplementation(async () => {
      store.initialized = true;
      store.authenticated = true;
      return true;
    });

    const result = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/checklist' }), store);

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});
