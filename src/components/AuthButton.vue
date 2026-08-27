<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { mdiAccountCircle, mdiLogout, mdiAccountCog } from '@mdi/js'
import { useAuth } from '@/composables/useAuth'
import { obtenerMiRol } from '@/services/admin'
import AuthDialog from './AuthDialog.vue'

const { user, signOut } = useAuth()
const router = useRouter()
const authDialog = ref(false)

/** Al cerrar sesión, volver a la vista inicial (elegir carrera) sin
 * importar en qué página se estaba — no tiene sentido quedarse en el
 * horario de una carrera, o en /admin, ya sin sesión. */
async function cerrarSesion() {
  await signOut()
  router.push('/')
}

// Solo para mostrar u ocultar el enlace "Administrar el sitio" — el
// control de acceso real a /admin lo dan las políticas RLS y las RPC
// `SECURITY DEFINER`, igual que ya documenta AdminView.vue.
const tienePermiso = ref(false)
watch(
  user,
  async () => {
    if (!user.value) {
      tienePermiso.value = false
      return
    }
    try {
      tienePermiso.value = (await obtenerMiRol()) !== null
    } catch {
      tienePermiso.value = false
    }
  },
  { immediate: true },
)

const nombreMostrado = computed(() => {
  if (!user.value) return ''
  const meta = (user.value.user_metadata ?? {}) as Record<string, unknown>
  const nombre =
    meta.full_name ?? meta.name ?? meta.nombre_completo ?? meta.given_name ?? user.value.email
  return typeof nombre === 'string' ? nombre.split(' ')[0] : ''
})
</script>

<template>
  <auth-dialog v-model="authDialog" />

  <v-menu v-if="user" location="bottom end">
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        :prepend-icon="mdiAccountCircle"
        variant="flat"
        size="small"
        class="user-cta-btn"
        >{{ nombreMostrado }}</v-btn
      >
    </template>
    <v-card theme="light" rounded="lg" min-width="220">
      <v-card-item class="dialog-header">
        <template #prepend>
          <v-icon :icon="mdiAccountCircle" color="white" />
        </template>
        <v-card-title class="text-white text-subtitle-1">{{ nombreMostrado }}</v-card-title>
      </v-card-item>
      <v-list density="compact">
        <v-list-item>
          <v-list-item-subtitle class="text-caption">{{ user.email }}</v-list-item-subtitle>
        </v-list-item>
        <v-divider />
        <v-list-item
          v-if="tienePermiso"
          :prepend-icon="mdiAccountCog"
          title="Administrar el sitio"
          @click="router.push('/admin')"
        />
        <v-divider v-if="tienePermiso" />
        <v-list-item :prepend-icon="mdiLogout" title="Cerrar sesión" @click="cerrarSesion" />
      </v-list>
    </v-card>
  </v-menu>
  <v-btn
    v-else
    :icon="mdiAccountCircle"
    variant="flat"
    size="small"
    class="user-cta-btn"
    @click="authDialog = true"
  />
</template>

<style scoped>
.dialog-header {
  background: #4285f4;
}

.user-cta-btn {
  background: linear-gradient(135deg, #e8f0fe 0%, #d2e3fc 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.7);
  color: #1a73e8 !important;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.22),
    0 8px 18px rgba(26, 115, 232, 0.28);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
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
