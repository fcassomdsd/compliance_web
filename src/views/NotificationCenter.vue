<template>
  <BaseManager title="Notifications">
    <p v-if="notificationStore.error" class="error-message">{{ notificationStore.error }}</p>

    <section class="card">
      <div class="list-header">
        <h3>My Notifications</h3>
        <label class="unread-toggle">
          <input type="checkbox" v-model="unreadOnly" @change="loadNotifications" />
          Unread only
        </label>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Body</th>
            <th>Received</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in notificationStore.notifications" :key="item.id" :class="{ 'unread-row': !item.readAt }">
            <td>{{ item.subject }}</td>
            <td>{{ item.body }}</td>
            <td>{{ formatDate(item.createdAt) || '-' }}</td>
            <td>{{ item.readAt ? 'Read' : 'Unread' }}</td>
            <td>
              <BaseButton v-if="!item.readAt" variant="ghost" size="sm" :disabled="notificationStore.loading" @click="markRead(item.id)">Mark read</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="authStore.hasRole('admin')" class="card">
      <h3>Critical Delivery Failures</h3>
      <p class="helper-text">Notifications marked critical that failed delivery after exhausting retries.</p>
      <table class="data-table">
        <thead>
          <tr>
            <th>Event Type</th>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Attempts</th>
            <th>Last Attempt</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in notificationStore.failures" :key="item.id">
            <td>{{ item.eventType }}</td>
            <td>{{ item.recipient }}</td>
            <td>{{ item.subject }}</td>
            <td>{{ item.attempts }}</td>
            <td>{{ formatDate(item.lastAttemptAt) || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <LoadingSpinner :visible="notificationStore.loading" />
  </BaseManager>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';

const notificationStore = useNotificationStore();
const authStore = useAuthStore();
const unreadOnly = ref(false);

async function loadNotifications() {
  await notificationStore.fetchNotifications(unreadOnly.value);
}

async function markRead(notificationId) {
  try {
    await notificationStore.markRead(notificationId, authStore.csrfToken);
  } catch (error) {
    console.error('Mark notification read failed:', error);
  }
}

onMounted(async () => {
  await loadNotifications();
  if (authStore.hasRole('admin')) {
    await notificationStore.fetchFailures();
  }
});
</script>

<style scoped>
.card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-white);
  margin-bottom: var(--space-4);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.unread-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.unread-row {
  background: var(--color-primary-100);
}

.helper-text {
  margin: 0 0 var(--space-3);
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.error-message {
  color: var(--color-error-700);
}
</style>
