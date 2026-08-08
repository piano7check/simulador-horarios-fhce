<script setup lang="ts">
import { ref } from 'vue'
import { mdiAccountCircle, mdiLogout } from '@mdi/js'
import AuthDialog from '@/components/AuthDialog.vue'
import { useAuth } from '@/composables/useAuth'

const { user, signOut } = useAuth()
const authDialog = ref(false)
</script>

<template>
  <v-app>
    <auth-dialog v-model="authDialog" />

    <div class="auth-btn-container">
      <v-menu v-if="user" location="bottom end">
        <template #activator="{ props }">
          <v-btn v-bind="props" :icon="mdiAccountCircle" variant="tonal" size="small" />
        </template>
        <v-list density="compact" min-width="200">
          <v-list-item>
            <v-list-item-subtitle class="text-caption">{{ user.email }}</v-list-item-subtitle>
          </v-list-item>
          <v-divider />
          <v-list-item :prepend-icon="mdiLogout" title="Cerrar sesión" @click="signOut" />
        </v-list>
      </v-menu>
      <v-btn v-else size="small" variant="tonal" @click="authDialog = true">
        Iniciar sesión
      </v-btn>
    </div>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<style scoped>
.auth-btn-container {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
}
</style>
