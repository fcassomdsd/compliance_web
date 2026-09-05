import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

import App from './App.vue';
import router from './router';
import i18n from './i18n';
import { useAuthStore } from '@/stores/authStore';

const app = createApp(App);
const pinia = createPinia();
const options = {
  timeout : 3000    // You can set your default options here
};

app.use(Toast, options);
app.use(pinia);
app.use(i18n);
app.use(router);

const authStore = useAuthStore(pinia);
authStore.init().catch(() => undefined).finally(() => {
  app.mount('#app');
});
