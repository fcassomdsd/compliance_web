<template>
  <BaseManager title="Inspector">
    <div class="input-group">
      <label for="orgId">Org ID:</label>
      <input id="orgId" type="text" v-model="newOrgId" placeholder="Organization ID"/>
      <label for="inspectorName">Name:</label>
      <input id="inspectorName" type="text" v-model="newInspectorName" placeholder="Inspector Name"/>
      <button @click="addInspector" :disabled="!newOrgId.trim() || !newInspectorName.trim()">Add Inspector</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 15%;">Org ID</th>
          <th style="width: 25%;">Name</th>
          <th style="width: 40%;">Specialties</th>
          <th style="width: 20%;">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="inspector in store.inspectors" :key="inspector.id">
          <td>
            <input type="text" v-model="inspector.orgId" :disabled="inspector.id !== editingInspectorId"/>
          </td>
          <td>
            <input type="text" v-model="inspector.name" :disabled="inspector.id !== editingInspectorId"/>
          </td>
          <td>
            <select
              multiple
              v-model="inspector.specialties"
              :disabled="inspector.id !== editingInspectorId"
              style="min-width: 100%; height: 100px;"
            >
              <option v-for="spec in specialtyStore.specialties" :key="spec.code" :value="spec.code">{{ spec.name }} ({{ spec.code }})</option>
            </select>
            <p v-if="inspector.id !== editingInspectorId" style="font-size: 0.8rem; margin-top: 0.5rem;">
              *Competencies: {{ inspector.specialties.join(', ') }}
            </p>
          </td>
          <td class="actions-cell">
            <input type="image" :src="editImg" height=40 width=40 @click="startEdit(inspector.id)"/>
            <button v-if="inspector.id !== editingInspectorId" @click="startEdit(inspector.id)">Edit</button>
            <button v-else @click="saveEdit(inspector)">Save</button>
            <button @click="deleteInspector(inspector.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </BaseManager>
</template>

<script setup>
import { ref } from 'vue';
import BaseManager from './BaseManager.vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { useSpecialtyStore } from '../stores/specialtyStore'; // To get the list of specialties
import editImg from '../images/edit.png';

const store = useInspectorStore();
const specialtyStore = useSpecialtyStore();

const newOrgId = ref('');
const newInspectorName = ref('');
const editingInspectorId = ref(null);

const addInspector = () => {
  store.addInspector(newOrgId.value.trim(), newInspectorName.value.trim(), []);
  newOrgId.value = '';
  newInspectorName.value = '';
};

const startEdit = (id) => {
  editingInspectorId.value = id;
};

const saveEdit = (inspector) => {
  store.updateInspector(inspector);
  editingInspectorId.value = null;
};

const deleteInspector = (id) => {
  if (confirm('Are you sure you want to delete this inspector?')) {
    store.deleteInspector(id);
  }
};
</script>
