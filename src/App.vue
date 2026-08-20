<script setup lang="ts">
import { mdiInformationOutline, mdiWhatsapp, mdiEmailOutline, mdiAccountOutline } from '@mdi/js'
import AuthButton from '@/components/AuthButton.vue'
</script>

<template>
  <v-app>
    <v-app-bar density="compact" flat class="google-topbar" color="#4285f4" theme="dark">
      <v-app-bar-title class="app-bar-title">
        <div class="d-flex align-center" style="min-width: 0">
          <router-link
            to="/"
            class="brand-link text-decoration-none d-inline-flex align-center ga-2"
          >
            <img src="/favicon.svg" alt="Icono de la app" class="app-logo" />
            <span class="brand-text">Simulador de Horarios FHCE</span>
          </router-link>
          <v-menu location="bottom start">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :prepend-icon="mdiInformationOutline"
                variant="text"
                size="small"
                class="ml-1 author-btn text-none"
              >
                Ing. Gustavo Rojas Valdivia
              </v-btn>
            </template>
            <v-card rounded="lg" min-width="240">
              <v-card-item class="dialog-header">
                <template #prepend>
                  <v-icon :icon="mdiAccountOutline" color="white" />
                </template>
                <v-card-title class="text-white text-subtitle-1">Autor</v-card-title>
              </v-card-item>
              <v-list density="compact">
                <v-list-item title="Ing. Gustavo Rojas Valdivia" class="font-weight-medium" />
                <v-divider />
                <v-list-item
                  :prepend-icon="mdiWhatsapp"
                  title="77435817"
                  href="https://wa.me/59177435817"
                  target="_blank"
                  rel="noopener"
                />
                <v-list-item
                  :prepend-icon="mdiEmailOutline"
                  title="grv.trainer@gmail.com"
                  href="mailto:grv.trainer@gmail.com"
                />
              </v-list>
            </v-card>
          </v-menu>
        </div>
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

.dialog-header {
  background: #4285f4;
}

.app-bar-title {
  min-width: 0;
  flex: 1 1 auto;
}

.brand-link {
  color: #fff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
  min-width: 0;
}

.brand-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.app-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  flex-shrink: 0;
}

.author-btn {
  color: #fff;
  font-size: 0.8rem;
  opacity: 0.92;
}

@media (max-width: 600px) {
  .author-btn {
    display: none;
  }
  .app-logo {
    width: 22px;
    height: 22px;
  }
  .brand-text {
    font-size: 0.92rem;
  }
}
</style>
