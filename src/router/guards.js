import { useAuthStore } from '@/stores/authStore';

function getRequiredRoles(to) {
  return to.matched
    .flatMap((record) => (Array.isArray(record.meta?.requiredRoles) ? record.meta.requiredRoles : []))
    .filter(Boolean);
}

async function ensureAuthInitialized(authStore) {
  try {
    await authStore.ensureSessionFresh();
  } catch {
    // Keep navigation deterministic even when bootstrap fails.
  }
}

export async function requireAuth(to, authStore) {
  const needsAuth = to.matched.some((record) => record.meta?.requiresAuth);
  if (!needsAuth) {
    return true;
  }

  const wasAuthenticated = authStore.authenticated;
  await ensureAuthInitialized(authStore);
  if (authStore.authenticated) {
    return true;
  }

  return {
    name: 'login',
    query: {
      redirect: to.fullPath,
      reason: wasAuthenticated ? 'expired' : 'auth_required',
    },
  };
}

export async function requireRole(to, authStore) {
  const requiredRoles = getRequiredRoles(to);
  if (requiredRoles.length === 0) {
    return true;
  }

  await ensureAuthInitialized(authStore);
  if (!authStore.authenticated) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (authStore.hasRole(requiredRoles)) {
    return true;
  }

  return {
    name: 'forbidden',
  };
}

export function applyAuthGuards(router, getAuthStore = () => useAuthStore()) {
  router.beforeEach(async (to) => {
    const authStore = getAuthStore();

    const authResult = await requireAuth(to, authStore);
    if (authResult !== true) {
      return authResult;
    }

    const roleResult = await requireRole(to, authStore);
    if (roleResult !== true) {
      return roleResult;
    }

    return true;
  });
}
