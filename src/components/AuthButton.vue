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
      <v-btn
        v-bind="props"
        :icon="mdiAccountCircle"
        variant="flat"
        size="default"
        class="user-cta-btn"
      />
    </template>
    <v-list density="compact" min-width="180">
      <v-list-item>
        <v-list-item-subtitle class="text-caption">{{ user.email }}</v-list-item-subtitle>
      </v-list-item>
      <v-divider />
      <v-list-item :prepend-icon="mdiLogout" title="Cerrar sesión" @click="signOut" />
    </v-list>
  </v-menu>
  <v-btn
    v-else
    :icon="mdiAccountCircle"
    variant="flat"
    size="default"
    class="user-cta-btn"
    @click="authDialog = true"
  />
</template>

<style scoped>
.user-cta-btn {
  background: linear-gradient(135deg, #e8f0fe 0%, #d2e3fc 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.7);
  color: #1a73e8 !important;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.22),
    0 8px 18px rgba(26, 115, 232, 0.28);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.user-cta-btn:hover {
  transform: translateY(-1px) scale(1.04);
  filter: brightness(1.03);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.32),
    0 10px 20px rgba(26, 115, 232, 0.34);
}

.user-cta-btn :deep(.v-icon) {
  color: #1a73e8;
  opacity: 1;
}
</style>
