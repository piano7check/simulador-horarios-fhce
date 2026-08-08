<script setup lang="ts">
import AuthButton from '@/components/AuthButton.vue'
</script>

<template>
  <v-app>
    <v-app-bar density="compact" flat border="b">
      <v-app-bar-title>
        <router-link to="/" class="text-decoration-none" style="color: inherit; font-weight: 500">
          Simulador de Horarios FHCE
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

<style scoped></style>
