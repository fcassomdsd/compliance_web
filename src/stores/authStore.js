import { defineStore } from 'pinia';
import { authLogin, authLogout, authSession } from '@/services/authServices';

function extractStatusCode(error) {
  const match = String(error?.message || '').match(/status code (\d{3})/i);
  return match ? Number(match[1]) : null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    initialized: false,
    loading: false,
    authenticated: false,
    user: null,
    roles: [],
    session: null,
    error: null,
  }),

  getters: {
    hasRole: (state) => (roleOrRoles) => {
      if (!roleOrRoles) return false;

      const required = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
      if (required.length === 0) return false;

      const roleSet = new Set((state.roles || []).map((role) => String(role).trim().toLowerCase()));
      return required.some((role) => roleSet.has(String(role).trim().toLowerCase()));
    },
  },

  actions: {
    applyAuthPayload(payload) {
      this.authenticated = Boolean(payload?.authenticated);
      this.user = payload?.user || null;
      this.roles = Array.isArray(payload?.roles) ? payload.roles : [];
      this.session = payload?.session || null;
      this.error = null;
    },

    clearAuthState() {
      this.authenticated = false;
      this.user = null;
      this.roles = [];
      this.session = null;
    },

    async init() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await authSession();
        this.applyAuthPayload(data);
        this.initialized = true;
        return this.authenticated;
      } catch (error) {
        const status = extractStatusCode(error);
        if (status === 401) {
          this.clearAuthState();
          this.initialized = true;
          return false;
        }

        this.clearAuthState();
        this.initialized = true;
        this.error = error.message;
        throw new Error('initAuth: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async login(username, password) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await authLogin(username, password);
        this.applyAuthPayload(data);
        this.initialized = true;
        return true;
      } catch (error) {
        this.clearAuthState();
        this.error = error.message;
        throw new Error('loginAuth: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      this.loading = true;
      this.error = null;
      try {
        await authLogout();
      } catch (error) {
        this.error = error.message;
      } finally {
        this.clearAuthState();
        this.initialized = true;
        this.loading = false;
      }
      return true;
    },
  },
});
