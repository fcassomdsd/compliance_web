<template>
  <div class="notification-bell">
    <BaseButton variant="ghost" size="sm" @click="toggleOpen">
      Notifications
      <span v-if="notificationStore.unreadCount > 0" class="unread-badge">{{ notificationStore.unreadCount }}</span>
    </BaseButton>

    <div v-if="open" class="notification-dropdown">
      <div v-if="notificationStore.loading" class="dropdown-empty">Loading...</div>
      <div v-else-if="!recentNotifications.length" class="dropdown-empty">No notifications.</div>
      <ul v-else class="dropdown-list">
        <li v-for="item in recentNotifications" :key="item.id" :class="{ unread: !item.readAt }">
          <div class="item-subject">{{ item.subject }}</div>
          <div class="item-body">{{ item.body }}</div>
          <div class="item-meta">
            <span>{{ formatDate(item.createdAt) }}</span>
            <BaseButton v-if="!item.readAt" variant="ghost" size="sm" @click="markRead(item.id)">Mark read</BaseButton>
          </div>
        </li>
      </ul>
      <RouterLink to="/notifications" class="view-all-link" @click="open = false">View all notifications</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';

const notificationStore = useNotificationStore();
const authStore = useAuthStore();
const open = ref(false);

const recentNotifications = computed(() => notificationStore.notifications.slice(0, 5));

async function toggleOpen() {
  open.value = !open.value;
  if (open.value) {
    await notificationStore.fetchNotifications();
  }
}

async function markRead(notificationId) {
  try {
    await notificationStore.markRead(notificationId, authStore.csrfToken);
  } catch (error) {
    console.error('Mark notification read failed:', error);
  }
}

// Polls independently of App.vue's session-keepalive interval — this is
// the first "poll for a badge count" instance in the app, kept on its own
// short interval since unread count should feel near-live while a user is
// on any page, not just tied to the 5-minute session-refresh cadence.
const POLL_INTERVAL_MS = 60 * 1000;
let pollTimer = null;

function pollUnreadCount() {
  if (!authStore.authenticated) {
    return;
  }
  notificationStore.fetchUnreadCount().catch((error) => {
    console.error('Notification unread-count poll failed:', error);
  });
}

onMounted(() => {
  pollUnreadCount();
  pollTimer = setInterval(pollUnreadCount, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  clearInterval(pollTimer);
});
</script>

<style scoped>
.notification-bell {
  position: relative;
}

.unread-badge {
  margin-left: var(--space-2);
  background: var(--color-error-700);
  color: var(--color-white);
  border-radius: var(--radius-sm);
  padding: 0.05rem 0.4rem;
  font-size: var(--text-xs);
}

.notification-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-2));
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--color-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  padding: var(--space-3);
}

.dropdown-empty {
  color: var(--color-gray-500);
  font-style: italic;
  font-size: var(--text-sm);
  padding: var(--space-2);
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dropdown-list li {
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.dropdown-list li.unread {
  background: var(--color-primary-100);
}

.item-subject {
  font-weight: 600;
  font-size: var(--text-sm);
}

.item-body {
  font-size: var(--text-sm);
  color: var(--color-gray-700);
}

.item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-gray-500);
}

.view-all-link {
  display: block;
  text-align: center;
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}
</style>
