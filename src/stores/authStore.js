import { defineStore } from 'pinia';
import { authLogin, authLogout, authSession, authTicket, authSetLocale } from '@/services/authServices';
import { apiInspectorByAlfrescoUser, setAlfrescoTicket } from '@/services/apiServices';

// Every role in the app's catalog except `inspector`; the mirror of
// SCOPE_EXEMPTING_ROLES in server/auth/specialtyScope.cjs. Keep the two in step.
const SCOPE_EXEMPTING_ROLES = ['admin', 'planner', 'assigner', 'reporter', 'cap_entry', 'closure_reviewer'];

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
    // Specialty codes this session may see and act on; null means unscoped
    // (any session not working as an inspector, no inspector record, no
    // specialties linked) — full access. The server enforces this on every write
    // and on the API responses; these getters keep the UI from offering what the
    // server would refuse.
    specialtyScope: null,
    specialtyScopeIds: null,
    inspectorProfile: null,
    session: null,
    csrfToken: null,
    locale: null,
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
    // Does this session work as an inspector? Holding any other catalog role
    // means the user is working under that role — a planner or an assigner who
    // also has an Inspector record is not an inspector here. Mirrors
    // SCOPE_EXEMPTING_ROLES in server/auth/specialtyScope.cjs, which is what
    // decides whether the session carries a specialty scope at all.
    isActingAsInspector: (state) => {
      if (!state.hasRole('inspector')) return false;
      return !state.hasRole(SCOPE_EXEMPTING_ROLES);
    },
    // null scope = unscoped, so every specialty is in scope.
    specialtyInScope: (state) => (code) => {
      if (!Array.isArray(state.specialtyScope) || state.specialtyScope.length === 0) return true;
      const wanted = String(code ?? '').trim().toUpperCase();
      if (!wanted) return true;
      return state.specialtyScope.includes(wanted);
    },
    // The same check for the id-keyed views (an inspected specialty is stored
    // as `spec_ats`, not as the code the document ids use).
    specialtyIdInScope: (state) => (specialtyId) => {
      if (!Array.isArray(state.specialtyScopeIds) || state.specialtyScopeIds.length === 0) return true;
      if (!specialtyId) return true;
      return state.specialtyScopeIds.includes(String(specialtyId).toLowerCase());
    },
  },

  actions: {
    applyAuthPayload(payload) {
      this.authenticated = Boolean(payload?.authenticated);
      this.user = payload?.user || null;
      this.roles = Array.isArray(payload?.roles) ? payload.roles : [];
      this.groups = Array.isArray(payload?.groups) ? payload.groups : [];
      this.specialtyScope =
        Array.isArray(payload?.specialtyScope) && payload.specialtyScope.length > 0
          ? payload.specialtyScope
          : null;
      this.specialtyScopeIds =
        Array.isArray(payload?.specialtyScopeIds) && payload.specialtyScopeIds.length > 0
          ? payload.specialtyScopeIds
          : null;
      this.session = payload?.session || null;
      this.csrfToken = payload?.csrfToken || null;
      this.locale = payload?.locale || null;
      this.error = null;
    },

    clearAuthState() {
      this.authenticated = false;
      this.user = null;
      this.roles = [];
      this.groups = [];
      this.specialtyScope = null;
      this.specialtyScopeIds = null;
      this.inspectorProfile = null;
      this.session = null;
      this.csrfToken = null;
      this.locale = null;
      setAlfrescoTicket(null);
    },

    async setLocale(locale) {
      const previous = this.locale;
      this.locale = locale;
      try {
        await authSetLocale(locale, this.csrfToken);
      } catch (error) {
        this.locale = previous;
        throw new Error('setLocale: ' + error.message);
      }
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

    // Note: this used to additionally derive an "assigner specialty scope" by
    // matching GROUP_U-VSO-IN_ASSIGNER* Alfresco groups (AssignerAGA/SNA/VA)
    // and narrowing which specialties an assigner could act on. The AGA/SNA/VA
    // assigner-domain concept has been retired platform-wide, so there is no
    // grouping left to key off and the narrowing has been removed entirely —
    // assigners now act on the full flat specialty list.
    async refreshDomainContext() {
      this.inspectorProfile = null;

      if (!this.authenticated || !this.user?.username) {
        return;
      }

      try {
        const { data } = await apiInspectorByAlfrescoUser(this.user.username);
        this.inspectorProfile = data || null;
      } catch {
        // Domain context is optional and should not block authentication.
      }
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
        try {
          await authLogout(this.csrfToken);
        } catch (error) {
          if (error.status === 401) {
            // The session is already gone server-side, so clearing is correct.
            this.clearAuthState();
            this.initialized = true;
            this.lastCheckedAt = Date.now();
            return true;
          }
          if (error.status !== 403) {
            throw error;
          }
          // Stale CSRF token. The server deliberately keeps the session on a
          // mismatch, so refresh the token from the session endpoint and retry
          // once instead of abandoning a live session.
          await this.init({ force: true });
          if (!this.authenticated) {
            this.clearAuthState();
            this.initialized = true;
            this.lastCheckedAt = Date.now();
            return true;
          }
          await authLogout(this.csrfToken);
        }

        this.clearAuthState();
        this.initialized = true;
        this.lastCheckedAt = Date.now();
        return true;
      } catch (error) {
        // The server session is still live; clearing client state here would
        // leave a valid session behind a UI that looks logged out. Keep the
        // state and surface the failure so the caller can retry.
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
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
