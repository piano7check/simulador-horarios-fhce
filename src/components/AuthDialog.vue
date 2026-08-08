<script setup lang="ts">
import { ref } from 'vue'
import { mdiGoogle } from '@mdi/js'
import { useAuth } from '@/composables/useAuth'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { signIn, signUp, signInWithGoogle } = useAuth()

const modo = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')
const mensajeConfirmacion = ref('')

function cerrar() {
  error.value = ''
  mensajeConfirmacion.value = ''
  emit('update:modelValue', false)
}

async function submit() {
  error.value = ''
  mensajeConfirmacion.value = ''
  cargando.value = true
  try {
    if (modo.value === 'login') {
      await signIn(email.value, password.value)
      cerrar()
    } else {
      const data = await signUp(email.value, password.value)
      if (data.session) {
        cerrar()
      } else {
        mensajeConfirmacion.value = 'Revisa tu correo y confirma tu cuenta para continuar.'
      }
    }
  } catch (e: any) {
    error.value = e.message ?? 'Error al autenticar'
  } finally {
    cargando.value = false
  }
}

async function loginConGoogle() {
  error.value = ''
  mensajeConfirmacion.value = ''
  cargando.value = true
  try {
    await signInWithGoogle()
  } catch (e: any) {
    error.value = e.message ?? 'Error al autenticar con Google'
    cargando.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="400" @update:model-value="cerrar">
    <v-card>
      <v-card-title class="text-h6 pt-5">
        {{ modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta' }}
      </v-card-title>

      <v-card-text>
        <v-alert v-if="mensajeConfirmacion" type="info" variant="tonal" class="mb-4">
          {{ mensajeConfirmacion }}
        </v-alert>

        <v-form v-else @submit.prevent="submit">
          <v-text-field
            v-model="email"
            label="Correo electrónico"
            type="email"
            autocomplete="email"
            variant="outlined"
            density="compact"
            class="mb-2"
            :disabled="cargando"
          />
          <v-text-field
            v-model="password"
            label="Contraseña"
            type="password"
            autocomplete="current-password"
            variant="outlined"
            density="compact"
            :disabled="cargando"
          />

          <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
            {{ error }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-4 pb-4 flex-column align-start ga-2">
        <div class="d-flex justify-end w-100 ga-2">
          <v-btn variant="text" @click="cerrar">Cancelar</v-btn>
          <v-btn
            v-if="!mensajeConfirmacion"
            color="primary"
            variant="flat"
            :loading="cargando"
            @click="submit"
          >
            {{ modo === 'login' ? 'Entrar' : 'Registrarse' }}
          </v-btn>
        </div>

        <div v-if="!mensajeConfirmacion" class="w-100">
          <v-divider class="my-1" />
          <v-btn
            block
            variant="outlined"
            :prepend-icon="mdiGoogle"
            :loading="cargando"
            class="mt-2"
            @click="loginConGoogle"
          >
            Continuar con Google
          </v-btn>
        </div>

        <v-btn
          v-if="!mensajeConfirmacion"
          variant="text"
          size="small"
          class="text-caption"
          @click="modo = modo === 'login' ? 'register' : 'login'"
        >
          {{
            modo === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Iniciar sesión'
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
