<template>
  <BaseManager title="Service Provider">
    <div class="input-group">
      <label for="providerName">Provider Name:</label>
      <input id="providerName" type="text" v-model="newProviderName" placeholder="Enter new service provider name"/>
      <label for="providerAlias">Provider Alias:</label>
      <input id="providerAlias" type="text" v-model="newProviderAlias" placeholder="Enter new service provider name"/>
      <input type="image" :src="addImg" height=30 width=30 @click="addProvider" :disabled="!newProviderName.trim() || !newProviderAlias.trim()" />
    </div>

    <table class="data-table">
      <colgroup>
        <col style="width: 50%;">
        <col style="width: 30%;">
        <col style="width: 20%;">
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Alias</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="provider in store.serviceProviders" :key="provider.id">
          <td>
            <input type="text" v-model="provider.name" :disabled="provider.id !== editingProvider.id"/>
          </td>
          <td>
            <input type="text" v-model="provider.alias" :disabled="provider.id !== editingProvider.id"/>
          </td>
          <td class="actions-cell" align="center">
            <div>
              <input v-if="provider.id !== editingProvider.id" type="image" :src="editImg" height=30 width=30 @click="startEdit(provider.id, provider.name, provider.alias)"/>
              <input v-else type="image" :src="saveImg" height=30 width=30 @click="saveEdit(provider)"/>
              <input v-if="provider.id !== editingProvider.id" type="image" :src="deleteImg" height=30 width=30 @click="deleteProvider(provider.id)"/>
              <input v-else type="image" :src="cancelImg" height=30 width=30 @click="cancelEdit()"/>
            </div>
          </td> 
        </tr>
      </tbody>
    </table>
  </BaseManager>
</template>

<script setup>
import { ref } from 'vue';
import BaseManager from './BaseManager.vue';
import { useServiceProviderStore } from '../stores/serviceProviderStore';
import editImg from '../images/edit.png';
import deleteImg from '../images/trash.png';
import saveImg from '../images/save.png';
import addImg from '../images/add.png';
import cancelImg from '../images/cancel.png';

const store = useServiceProviderStore();

const newProviderName = ref('');
const newProviderAlias = ref('');
const editingProvider = ref({});

store.refreshServiceProviders();

const addProvider = () => {
  store.addServiceProvider({ "name" : newProviderName.value.trim(), "alias" : newProviderAlias.value.trim() });
  newProviderName.value = '';
  newProviderAlias.value = '';
};

const startEdit = (id, name, alias) => {
  editingProvider.value["id"] = id;
  editingProvider.value["name"] = name;
  editingProvider.value["alias"] = alias;
};

const saveEdit = (provider) => {
  store.updateServiceProvider(provider);
  editingProvider.value["id"] = null;
};

const deleteProvider = (id) => {
  if (confirm('Are you sure you want to delete this service provider?')) {
    store.deleteServiceProvider(id);
  }
};

const cancelEdit = () => {
  store.cancelServiceProviderUpdate(editingProvider.value);
  editingProvider.value.id = null;
}
</script>
<style scoped>
.input-group label,input[type=text] {
  margin-bottom: 0%; 
}

.input-group input[type=text] {
  margin-right: 1rem;
}

.data-table {
  width: 50%;
}

.data-table input[type=text] {
  width: 100%;
}
</style>
