import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/authStore';
import { applyAuthGuards, requireAuth, requireRole } from '@/router/guards';

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
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(false);

    const result = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/inspection' }), store);
    expect(result).toEqual({
      name: 'login',
      query: { redirect: '/inspection', reason: 'auth_required' },
    });
  });

  it('requireAuth allows authenticated users', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(true);

    const result = await requireAuth(buildRoute({ requiresAuth: true }), store);
    expect(result).toBe(true);
  });

  it('requireRole allows any-role match', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    store.roles = ['planner'];
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(true);

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
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(true);

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
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(false);

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

  it('requireRole allows routes without role requirements', async () => {
    const store = useAuthStore();
    const result = await requireRole(buildRoute({ requiresAuth: true, requiredRoles: [] }), store);
    expect(result).toBe(true);
  });

  it('initializes auth store on first protected navigation', async () => {
    const store = useAuthStore();
    store.initialized = false;
    const freshSpy = vi.spyOn(store, 'ensureSessionFresh').mockImplementation(async () => {
      store.initialized = true;
      store.authenticated = true;
      return true;
    });

    const result = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/checklist' }), store);

    expect(freshSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('requireAuth marks expired session reason when user was previously authenticated', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;

    vi.spyOn(store, 'ensureSessionFresh').mockImplementation(async () => {
      store.authenticated = false;
      return false;
    });

    const result = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/inspection-plan' }), store);

    expect(result).toEqual({
      name: 'login',
      query: {
        redirect: '/inspection-plan',
        reason: 'expired',
      },
    });
  });

  it('guard helpers tolerate session refresh errors', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = false;
    vi.spyOn(store, 'ensureSessionFresh').mockRejectedValue(new Error('boom'));

    const authResult = await requireAuth(buildRoute({ requiresAuth: true, fullPath: '/inspection' }), store);
    const roleResult = await requireRole(buildRoute({ requiresAuth: true, requiredRoles: ['admin'], fullPath: '/inspection' }), store);

    expect(authResult).toEqual({
      name: 'login',
      query: { redirect: '/inspection', reason: 'auth_required' },
    });
    expect(roleResult).toEqual({
      name: 'login',
      query: { redirect: '/inspection' },
    });
  });

  it('applyAuthGuards wires router beforeEach and returns role redirect', async () => {
    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    store.roles = ['inspector'];
    vi.spyOn(store, 'ensureSessionFresh').mockResolvedValue(true);

    let guard;
    const router = {
      beforeEach: vi.fn((callback) => {
        guard = callback;
      }),
    };

    applyAuthGuards(router, () => store);

    expect(router.beforeEach).toHaveBeenCalledTimes(1);

    const result = await guard(buildRoute({ requiresAuth: true, requiredRoles: ['admin'], fullPath: '/inspection-report' }));
    expect(result).toEqual({ name: 'forbidden' });
  });
});
