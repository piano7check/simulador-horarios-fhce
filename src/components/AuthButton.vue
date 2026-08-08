<script setup lang="ts">
import { ref } from 'vue'
import { mdiAccountCircle, mdiLogout } from '@mdi/js'
import { useAuth } from '@/composables/useAuth'
import AuthDialog from './AuthDialog.vue'

const { user, signOut } = useAuth()
const authDialog = ref(false)
</script>

<template>
  <auth-dialog v-model="authDialog" />

  <v-menu v-if="user" location="bottom end">
    <template #activator="{ props }">
      <v-btn v-bind="props" :icon="mdiAccountCircle" variant="text" size="small" />
    </template>
    <v-list density="compact" min-width="180">
      <v-list-item>
        <v-list-item-subtitle class="text-caption">{{ user.email }}</v-list-item-subtitle>
      </v-list-item>
      <v-divider />
      <v-list-item :prepend-icon="mdiLogout" title="Cerrar sesión" @click="signOut" />
    </v-list>
  </v-menu>
  <v-btn v-else :icon="mdiAccountCircle" variant="text" size="small" @click="authDialog = true" />
</template>
