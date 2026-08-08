<script setup lang="ts">
import AuthButton from '@/components/AuthButton.vue'
</script>

<template>
  <v-app>
    <v-app-bar density="compact" flat class="google-topbar" color="#4285f4" theme="dark">
      <v-app-bar-title>
        <router-link
          to="/"
          class="brand-link text-decoration-none d-inline-flex align-center ga-2"
        >
          <img src="/favicon.svg" alt="Icono de la app" class="app-logo" />
          <span>Simulador de Horarios FHCE</span>
        </router-link>
      </v-app-bar-title>
      <template #append>
        <auth-button class="mr-1" />
      </template>
    </v-app-bar>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<style scoped>
.google-topbar {
  background: #4285f4;
  color: #fff;
}

.brand-link {
  color: #fff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
}

.app-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}
</style>
