import { defineStore } from 'pinia';
import {
  apiListNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiListNotificationFailures,
} from '@/services/apiServices';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    notifications: [],
    failures: [],
    unreadCount: 0,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchNotifications(unreadOnly = false) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiListNotifications(unreadOnly);
        this.notifications = Array.isArray(data?.list) ? data.list : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchUnreadCount() {
      try {
        const { data } = await apiGetUnreadNotificationCount();
        this.unreadCount = Number.isInteger(data?.count) ? data.count : 0;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async markRead(notificationId, csrfToken) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiMarkNotificationRead(notificationId, csrfToken);
        const index = this.notifications.findIndex((entry) => entry.id === notificationId);
        if (index !== -1 && data?.notification) {
          this.notifications[index] = data.notification;
        }
        if (this.unreadCount > 0) {
          this.unreadCount -= 1;
        }
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchFailures() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiListNotificationFailures();
        this.failures = Array.isArray(data?.list) ? data.list : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
