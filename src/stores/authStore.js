import { defineStore } from 'pinia';
import { authLogin, authLogout, authSession, authTicket } from '@/services/authServices';
import { apiAssignmentGroup, apiInspectorByAlfrescoUser, setAlfrescoTicket } from '@/services/apiServices';

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
    groups: [],
    inspectorProfile: null,
    assignerSpecialties: [],
    session: null,
    csrfToken: null,
    error: null,
    lastCheckedAt: null,
  }),

  getters: {
    hasRole: (state) => (roleOrRoles) => {
      if (!roleOrRoles) return false;

      const required = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
      if (required.length === 0) return false;

      const roleSet = new Set((state.roles || []).map((role) => String(role).trim().toLowerCase()));
      return required.some((role) => roleSet.has(String(role).trim().toLowerCase()));
    },
    assignerSpecialtyIds: (state) => {
      return new Set((state.assignerSpecialties || []).map((specialty) => specialty?.id).filter(Boolean));
    },
    canManageServiceArea: (state) => (serviceAreaId) => {
      if (!state.hasRole('planner')) return false;
      const plannerArea = state.inspectorProfile?.serviceAreaId;
      if (plannerArea === null || plannerArea === undefined) return true;
      return plannerArea === serviceAreaId;
    },
  },

  actions: {
    applyAuthPayload(payload) {
      this.authenticated = Boolean(payload?.authenticated);
      this.user = payload?.user || null;
      this.roles = Array.isArray(payload?.roles) ? payload.roles : [];
      this.groups = Array.isArray(payload?.groups) ? payload.groups : [];
      this.session = payload?.session || null;
      this.csrfToken = payload?.csrfToken || null;
      this.error = null;
    },

    clearAuthState() {
      this.authenticated = false;
      this.user = null;
      this.roles = [];
      this.groups = [];
      this.inspectorProfile = null;
      this.assignerSpecialties = [];
      this.session = null;
      this.csrfToken = null;
      setAlfrescoTicket(null);
    },

    async refreshServiceTicket() {
      if (!this.csrfToken) return;
      try {
        const { data } = await authTicket(this.csrfToken);
        setAlfrescoTicket(data?.ticket || null);
      } catch {
        setAlfrescoTicket(null);
      }
    },

    async refreshDomainContext() {
      this.inspectorProfile = null;
      this.assignerSpecialties = [];

      if (!this.authenticated || !this.user?.username) {
        return;
      }

      try {
        const { data } = await apiInspectorByAlfrescoUser(this.user.username);
        this.inspectorProfile = data || null;
      } catch {
        // Domain context is optional and should not block authentication.
      }

      if (!this.hasRole('assigner')) {
        return;
      }

      const scopedAssignerGroups = (this.groups || []).filter((group) => {
        const normalized = String(group || '').trim().toUpperCase();
        return normalized.startsWith('GROUP_U-VSO-IN_ASSIGNER') && normalized !== 'GROUP_U-VSO-IN_ASSIGNER';
      });

      if (scopedAssignerGroups.length === 0) {
        return;
      }

      const specialtyMap = new Map();
      for (const group of scopedAssignerGroups) {
        try {
          const { data } = await apiAssignmentGroup(group);
          for (const specialty of data?.specialties || []) {
            if (specialty?.id) {
              specialtyMap.set(specialty.id, specialty);
            }
          }
        } catch {
          // Keep partial scope resolution when one mapping call fails.
        }
      }

      this.assignerSpecialties = Array.from(specialtyMap.values());
    },

    async init(options = {}) {
      const { force = false } = options;

      if (!force && this.loading) {
        return this.authenticated;
      }

      this.loading = true;
      this.error = null;
      try {
        const { data } = await authSession();
        this.applyAuthPayload(data);
        await this.refreshServiceTicket();
        void this.refreshDomainContext();
        this.initialized = true;
        this.lastCheckedAt = Date.now();
        return this.authenticated;
      } catch (error) {
        const status = extractStatusCode(error);
        if (status === 401) {
          this.clearAuthState();
          this.initialized = true;
          this.lastCheckedAt = Date.now();
          return false;
        }

        this.clearAuthState();
        this.initialized = true;
        this.lastCheckedAt = Date.now();
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
        await this.refreshServiceTicket();
        void this.refreshDomainContext();
        this.initialized = true;
        this.lastCheckedAt = Date.now();
        return true;
      } catch (error) {
        this.clearAuthState();
        this.lastCheckedAt = Date.now();
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
        await authLogout(this.csrfToken);
      } catch (error) {
        this.error = error.message;
      } finally {
        this.clearAuthState();
        this.initialized = true;
        this.lastCheckedAt = Date.now();
        this.loading = false;
      }
      return true;
    },

    async ensureSessionFresh(maxAgeMs = 60000) {
      const age = this.lastCheckedAt ? Date.now() - this.lastCheckedAt : Number.POSITIVE_INFINITY;
      if (!this.initialized || age > maxAgeMs) {
        await this.init({ force: true });
      }
      return this.authenticated;
    },
  },
});
