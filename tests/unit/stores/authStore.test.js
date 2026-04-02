import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useAuthStore } from '@/stores/authStore';
import { authLogin, authLogout, authSession } from '@/services/authServices';
import { apiAssignmentGroup, apiInspectorByAlfrescoUser } from '@/services/apiServices';

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

  it('refreshDomainContext loads inspector profile and assigner specialties', async () => {
    vi.mocked(apiInspectorByAlfrescoUser).mockResolvedValue({
      status: 200,
      data: { id: 'I1', name: 'Fernando', specialties: [{ id: 'S1', name: 'Spec 1' }] },
    });
    vi.mocked(apiAssignmentGroup).mockResolvedValue({
      status: 200,
      data: { specialties: [{ id: 'S1', name: 'Spec 1' }, { id: 'S2', name: 'Spec 2' }] },
    });

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { username: 'fernando.casso' };
    store.roles = ['assigner'];
    store.groups = ['GROUP_U-VSO-IN_Assigner', 'GROUP_U-VSO-IN_AssignerAGA'];

    await store.refreshDomainContext();

    expect(apiInspectorByAlfrescoUser).toHaveBeenCalledWith('fernando.casso');
    expect(apiAssignmentGroup).toHaveBeenCalledWith('GROUP_U-VSO-IN_AssignerAGA');
    expect(store.inspectorProfile?.id).toBe('I1');
    expect(Array.from(store.assignerSpecialtyIds)).toEqual(['S1', 'S2']);
  });

  it('refreshDomainContext tolerates optional lookup failures', async () => {
    vi.mocked(apiInspectorByAlfrescoUser).mockRejectedValue(new Error('boom'));
    vi.mocked(apiAssignmentGroup).mockRejectedValue(new Error('boom'));

    const store = useAuthStore();
    store.authenticated = true;
    store.user = { username: 'fernando.casso' };
    store.roles = ['assigner'];
    store.groups = ['GROUP_U-VSO-IN_AssignerSNA'];

    await expect(store.refreshDomainContext()).resolves.toBeUndefined();
    expect(store.inspectorProfile).toBeNull();
    expect(store.assignerSpecialties).toEqual([]);
  });

  it('init rethrows non-401 auth session failures', async () => {
    vi.mocked(authSession).mockRejectedValue(new Error('authSession: Request failed with status code 503'));

    const store = useAuthStore();
    await expect(store.init()).rejects.toThrow('initAuth: authSession: Request failed with status code 503');
    expect(store.authenticated).toBe(false);
    expect(store.error).toContain('authSession: Request failed with status code 503');
  });
});
