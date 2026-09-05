<template>
  <BaseManager :title="t('notificationCenter.title')">
    <p v-if="notificationStore.error" class="error-message">{{ notificationStore.error }}</p>

    <section class="card">
      <div class="list-header">
        <h3>{{ t('notificationCenter.myNotifications') }}</h3>
        <label class="unread-toggle">
          <input type="checkbox" v-model="unreadOnly" @change="loadNotifications" />
          {{ t('notificationCenter.unreadOnly') }}
        </label>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('notificationCenter.table.subject') }}</th>
            <th>{{ t('notificationCenter.table.body') }}</th>
            <th>{{ t('notificationCenter.table.received') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in notificationStore.notifications" :key="item.id" :class="{ 'unread-row': !item.readAt }">
            <td>{{ item.subject }}</td>
            <td>{{ item.body }}</td>
            <td>{{ formatDate(item.createdAt) || '-' }}</td>
            <td>{{ item.readAt ? t('notificationCenter.read') : t('notificationCenter.unread') }}</td>
            <td>
              <BaseButton v-if="!item.readAt" variant="ghost" size="sm" :disabled="notificationStore.loading" @click="markRead(item.id)">{{ t('notificationCenter.markRead') }}</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="authStore.hasRole('admin')" class="card">
      <h3>{{ t('notificationCenter.criticalFailures') }}</h3>
      <p class="helper-text">{{ t('notificationCenter.criticalFailuresHelp') }}</p>
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('notificationCenter.table.eventType') }}</th>
            <th>{{ t('notificationCenter.table.recipient') }}</th>
            <th>{{ t('notificationCenter.table.subject') }}</th>
            <th>{{ t('notificationCenter.table.attempts') }}</th>
            <th>{{ t('notificationCenter.table.lastAttempt') }}</th>
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
import { useI18n } from 'vue-i18n';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';

const { t } = useI18n();
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
