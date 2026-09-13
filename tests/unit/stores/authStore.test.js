import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/authStore';
import { authLogin, authLogout, authSession } from '@/services/authServices';
import { apiInspectorByAlfrescoUser } from '@/services/apiServices';

vi.mock('@/services/authServices');
vi.mock('@/services/apiServices');

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

  function seedAuthenticatedState(store) {
    store.authenticated = true;
    store.user = { id: 'u3', username: 'carol', displayName: 'Carol' };
    store.roles = ['admin'];
  }

  it('logout clears state when the server destroys the session', async () => {
    vi.mocked(authLogout).mockResolvedValue({ status: 200, data: { ok: true } });

    const store = useAuthStore();
    seedAuthenticatedState(store);

    const result = await store.logout();

    expect(result).toBe(true);
    expect(store.initialized).toBe(true);
    expect(store.authenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.roles).toEqual([]);
  });

  it('logout clears state when the session is already gone (401)', async () => {
    const gone = new Error('authLogout: Request failed with status code 401');
    gone.status = 401;
    vi.mocked(authLogout).mockRejectedValue(gone);

    const store = useAuthStore();
    seedAuthenticatedState(store);

    const result = await store.logout();

    expect(result).toBe(true);
    expect(store.authenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.error).toBeNull();
  });

  it('logout refreshes a stale CSRF token (403) and retries once', async () => {
    const csrfFailure = new Error('authLogout: Request failed with status code 403');
    csrfFailure.status = 403;
    vi.mocked(authLogout)
      .mockRejectedValueOnce(csrfFailure)
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });
    vi.mocked(authSession).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u3', username: 'carol', displayName: 'Carol' },
        roles: ['admin'],
        session: { expiresAt: '2026-03-31T20:00:00Z' },
      },
    });

    const store = useAuthStore();
    seedAuthenticatedState(store);

    const result = await store.logout();

    expect(result).toBe(true);
    expect(authLogout).toHaveBeenCalledTimes(2);
    expect(store.authenticated).toBe(false);
  });

  it('logout keeps client state when the session cannot be destroyed', async () => {
    const networkFailure = new Error('authLogout: network');
    vi.mocked(authLogout).mockRejectedValue(networkFailure);

    const store = useAuthStore();
    seedAuthenticatedState(store);

    await expect(store.logout()).rejects.toThrow('authLogout: network');

    // The server session is still live, so the UI must not pretend otherwise.
    expect(store.authenticated).toBe(true);
    expect(store.user).not.toBeNull();
    expect(store.roles).toEqual(['admin']);
    expect(store.error).toBe('authLogout: network');
    expect(store.initialized).toBe(false);
  });

  it('logout keeps client state when an unrecoverable CSRF failure persists', async () => {
    const csrfFailure = new Error('authLogout: Request failed with status code 403');
    csrfFailure.status = 403;
    vi.mocked(authLogout).mockRejectedValue(csrfFailure);
    vi.mocked(authSession).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u3', username: 'carol', displayName: 'Carol' },
        roles: ['admin'],
        session: { expiresAt: '2026-03-31T20:00:00Z' },
      },
    });

    const store = useAuthStore();
    seedAuthenticatedState(store);

    await expect(store.logout()).rejects.toThrow('authLogout: Request failed with status code 403');

    expect(store.authenticated).toBe(true);
    expect(store.error).toBe('authLogout: Request failed with status code 403');
  });

  it('hasRole uses any-role matching and case-insensitive checks', () => {
    const store = useAuthStore();
    store.roles = ['Inspector', 'Planner'];

    expect(store.hasRole('inspector')).toBe(true);
    expect(store.hasRole(['reporter', 'planner'])).toBe(true);
    expect(store.hasRole(['reporter', 'admin'])).toBe(false);
  });

  it('ensureSessionFresh refreshes when store is stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T10:00:00Z'));

    vi.mocked(authSession).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u5', username: 'fresh', displayName: 'Fresh' },
        roles: ['inspector'],
        session: { expiresAt: '2026-03-31T10:30:00Z' },
      },
    });

    const store = useAuthStore();
    store.initialized = true;
    store.authenticated = true;
    store.lastCheckedAt = Date.now() - 120000;

    const initSpy = vi.spyOn(store, 'init');
    const result = await store.ensureSessionFresh(60000);

    expect(result).toBe(true);
    expect(initSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('init stores groups from session payload', async () => {
    vi.mocked(authSession).mockResolvedValue({
      status: 200,
      data: {
        authenticated: true,
        user: { id: 'u6', username: 'alice', displayName: 'Alice' },
        roles: ['assigner'],
        groups: ['GROUP_U-VSO-IN_Assigner', 'GROUP_U-VSO-IN_AssignerAGA'],
        session: { expiresAt: '2026-03-31T20:00:00Z' },
      },
    });

    const store = useAuthStore();
    await store.init();

    expect(store.groups).toEqual(['GROUP_U-VSO-IN_Assigner', 'GROUP_U-VSO-IN_AssignerAGA']);
  });

  it('refreshDomainContext loads the inspector profile', async () => {
    vi.mocked(apiInspectorByAlfrescoUser).mockResolvedValue({
      status: 200,
      data: { id: 'I1', name: 'Fernando', specialties: [{ id: 'S1', name: 'Spec 1' }] },
    });

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { username: 'fernando.casso' };
    store.roles = ['assigner'];
    store.groups = ['GROUP_U-VSO-IN_Assigner', 'GROUP_U-VSO-IN_AssignerAGA'];

    await store.refreshDomainContext();

    expect(apiInspectorByAlfrescoUser).toHaveBeenCalledWith('fernando.casso');
    expect(store.inspectorProfile?.id).toBe('I1');
  });

  it('refreshDomainContext no longer derives a specialty scope from assigner domain groups', async () => {
    vi.mocked(apiInspectorByAlfrescoUser).mockResolvedValue({
      status: 200,
      data: { id: 'I1', name: 'Fernando' },
    });

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { username: 'fernando.casso' };
    store.roles = ['assigner'];
    store.groups = ['GROUP_U-VSO-IN_Assigner', 'GROUP_U-VSO-IN_AssignerAGA'];

    await store.refreshDomainContext();

    // The AGA/SNA/VA assigner-domain grouping has been retired platform-wide:
    // assigners now act on the full flat specialty list, so no group-derived
    // narrowing is computed or exposed at all.
    expect(store.assignerSpecialties).toBeUndefined();
    expect(store.assignerSpecialtyIds).toBeUndefined();
  });

  it('refreshDomainContext tolerates optional lookup failures', async () => {
    vi.mocked(apiInspectorByAlfrescoUser).mockRejectedValue(new Error('boom'));

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { username: 'fernando.casso' };
    store.roles = ['assigner'];
    store.groups = ['GROUP_U-VSO-IN_AssignerSNA'];

    await expect(store.refreshDomainContext()).resolves.toBeUndefined();
    expect(store.inspectorProfile).toBeNull();
  });

  it('init rethrows non-401 auth session failures', async () => {
    vi.mocked(authSession).mockRejectedValue(new Error('authSession: Request failed with status code 503'));

    const store = useAuthStore();
    await expect(store.init()).rejects.toThrow('initAuth: authSession: Request failed with status code 503');
    expect(store.authenticated).toBe(false);
    expect(store.error).toContain('authSession: Request failed with status code 503');
  });
});
