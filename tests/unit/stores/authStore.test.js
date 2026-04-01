import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/authStore';
import { authLogin, authLogout, authSession } from '@/services/authServices';

vi.mock('@/services/authServices');

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('init loads authenticated session', async () => {
    vi.mocked(authSession).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u1', username: 'alice', displayName: 'Alice' },
        roles: ['inspector'],
        session: { expiresAt: '2026-03-31T20:00:00Z' },
      },
    });

    const store = useAuthStore();
    const result = await store.init();

    expect(result).toBe(true);
    expect(store.initialized).toBe(true);
    expect(store.authenticated).toBe(true);
    expect(store.user?.username).toBe('alice');
    expect(store.roles).toEqual(['inspector']);
  });

  it('init handles anonymous session as non-error', async () => {
    vi.mocked(authSession).mockRejectedValue(new Error('authSession: Request failed with status code 401'));

    const store = useAuthStore();
    const result = await store.init();

    expect(result).toBe(false);
    expect(store.initialized).toBe(true);
    expect(store.authenticated).toBe(false);
    expect(store.roles).toEqual([]);
    expect(store.error).toBeNull();
  });

  it('login sets auth payload', async () => {
    vi.mocked(authLogin).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u2', username: 'bob', displayName: 'Bob' },
        roles: ['planner', 'reporter'],
        session: { expiresAt: '2026-03-31T21:00:00Z' },
      },
    });

    const store = useAuthStore();
    const result = await store.login('bob', 'secret');

    expect(result).toBe(true);
    expect(store.authenticated).toBe(true);
    expect(store.user?.displayName).toBe('Bob');
    expect(store.roles).toEqual(['planner', 'reporter']);
  });

  it('logout clears state even when API fails', async () => {
    vi.mocked(authLogout).mockRejectedValue(new Error('authLogout: network')); 

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { id: 'u3', username: 'carol', displayName: 'Carol' };
    store.roles = ['admin'];

    const result = await store.logout();

    expect(result).toBe(true);
    expect(store.initialized).toBe(true);
    expect(store.authenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.roles).toEqual([]);
  });

  it('hasRole uses any-role matching and case-insensitive checks', () => {
    const store = useAuthStore();
    store.roles = ['Inspector', 'Planner'];

    expect(store.hasRole('inspector')).toBe(true);
    expect(store.hasRole(['reporter', 'planner'])).toBe(true);
    expect(store.hasRole(['reporter', 'admin'])).toBe(false);
  });
});
