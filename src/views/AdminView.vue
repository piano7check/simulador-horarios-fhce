<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { mdiChevronLeft, mdiContentSave, mdiLogout } from '@mdi/js'
import { useAuth } from '@/composables/useAuth'
import AuthDialog from '@/components/AuthDialog.vue'
import {
  obtenerCarreras,
  obtenerMaterias,
  obtenerDocentesPorCarrera,
  GESTION_ACTUAL,
  type Carrera,
  type Materia,
} from '@/services/horarios'
import {
  obtenerMiRol,
  obtenerGruposAdmin,
  actualizarGrupoExtra,
  type GrupoAdmin,
  type RolUsuario,
} from '@/services/admin'
import { normalizarTexto } from '@/utils/texto'

const GESTION = GESTION_ACTUAL
const FACULTAD_ID = 1

const { user, signOut } = useAuth()
const authDialog = ref(false)

const verificandoRol = ref(false)
const miRol = ref<RolUsuario | null>(null)
// null solo significa "todavía no se consultó"; se distingue de "consultado
// y es estudiante" con estaVerificado, para no mostrar "sin permisos" antes
// de tiempo mientras se resuelve la consulta.
const rolVerificado = ref(false)
// Hoy ambos roles de staff tienen el mismo permiso (cargar aula
// virtual/WhatsApp); cuando administrador tenga permisos extra, esas
// pantallas van a chequear miRol === 'administrador' puntualmente.
const tienePermiso = computed(() => miRol.value !== null)

async function verificarRol() {
  if (!user.value) {
    miRol.value = null
    rolVerificado.value = false
    return
  }
  verificandoRol.value = true
  try {
    miRol.value = await obtenerMiRol()
  } catch {
    miRol.value = null
  } finally {
    rolVerificado.value = true
    verificandoRol.value = false
  }
}

watch(user, verificarRol, { immediate: true })

// -- Carreras / materias / grupos --
const carreras = ref<Carrera[]>([])
const cargandoCarreras = ref(false)
const carreraSeleccionada = ref<Carrera | null>(null)

const materias = ref<Materia[]>([])
const cargandoMaterias = ref(false)
const materiaSeleccionada = ref<Materia | null>(null)

// Docentes por materia (materia_id -> nombres), para poder buscar por
// docente igual que en el buscador de materias del planificador.
const docentesPorMateria = ref<Map<number, string[]>>(new Map())
const busquedaMateria = ref('')

function materiaCoincidePorTexto(m: Materia, termino: string) {
  return normalizarTexto(m.nombre).includes(termino) || normalizarTexto(m.codigo).includes(termino)
}

function docenteDeMateriaQueCoincide(materiaId: number, termino: string): string | null {
  const docentes = docentesPorMateria.value.get(materiaId) ?? []
  return docentes.find((d) => normalizarTexto(d).includes(termino)) ?? null
}

const materiasFiltradas = computed(() => {
  const termino = normalizarTexto(busquedaMateria.value)
  if (!termino) return materias.value
  return materias.value.filter(
    (m) =>
      materiaCoincidePorTexto(m, termino) || docenteDeMateriaQueCoincide(m.id, termino) !== null,
  )
})

/** Nombre del docente que hizo coincidir la materia en la búsqueda actual,
 * solo si el nombre/código de la materia por sí solo NO coincidía. */
function docenteQueCoincide(materia: Materia): string | null {
  const termino = normalizarTexto(busquedaMateria.value)
  if (!termino || materiaCoincidePorTexto(materia, termino)) return null
  return docenteDeMateriaQueCoincide(materia.id, termino)
}

const grupos = ref<GrupoAdmin[]>([])
const cargandoGrupos = ref(false)

// Edición local por grupo, para no pisar lo cargado en el server mientras
// el admin todavía está escribiendo.
const edicion = ref<Record<number, { aulaVirtual: string; whatsappGrupo: string }>>({})
const guardando = ref<Record<number, boolean>>({})
const snackbarMsg = ref('')
const snackbar = ref(false)
const snackbarColor = ref<'success' | 'error'>('success')

async function cargarCarreras() {
  cargandoCarreras.value = true
  try {
    carreras.value = await obtenerCarreras(FACULTAD_ID)
  } finally {
    cargandoCarreras.value = false
  }
}

watch(tienePermiso, (v) => {
  if (v) cargarCarreras()
})

onMounted(() => {
  if (tienePermiso.value) cargarCarreras()
})

async function seleccionarCarrera(carrera: Carrera | null) {
  carreraSeleccionada.value = carrera
  materiaSeleccionada.value = null
  materias.value = []
  grupos.value = []
  busquedaMateria.value = ''
  docentesPorMateria.value = new Map()
  if (!carrera) return
  cargandoMaterias.value = true
  try {
    materias.value = await obtenerMaterias(carrera.id)
  } finally {
    cargandoMaterias.value = false
  }

  // Aparte y sin bloquear: si falla, el selector sigue funcionando, solo
  // no se puede buscar por docente hasta que se pueda cargar.
  try {
    const listaDocentes = await obtenerDocentesPorCarrera(carrera.id, GESTION)
    const mapa = new Map<number, string[]>()
    for (const { materia_id, docente } of listaDocentes) {
      const lista = mapa.get(materia_id) ?? []
      lista.push(docente)
      mapa.set(materia_id, lista)
    }
    docentesPorMateria.value = mapa
  } catch {
    docentesPorMateria.value = new Map()
  }
}

async function seleccionarMateria(materia: Materia | null) {
  materiaSeleccionada.value = materia
  grupos.value = []
  if (!materia) return
  cargandoGrupos.value = true
  try {
    grupos.value = await obtenerGruposAdmin(materia.id, GESTION)
    edicion.value = Object.fromEntries(
      grupos.value.map((g) => [
        g.id,
        { aulaVirtual: g.aula_virtual ?? '', whatsappGrupo: g.whatsapp_grupo ?? '' },
      ]),
    )
  } finally {
    cargandoGrupos.value = false
  }
}

async function guardarGrupo(grupo: GrupoAdmin) {
  const datos = edicion.value[grupo.id]
  if (!datos) return
  guardando.value = { ...guardando.value, [grupo.id]: true }
  try {
    await actualizarGrupoExtra(
      grupo.id,
      datos.aulaVirtual.trim() || null,
      datos.whatsappGrupo.trim() || null,
    )
    snackbarMsg.value = `Guardado: Grupo ${grupo.numero}`
    snackbarColor.value = 'success'
    snackbar.value = true
  } catch (e: any) {
    snackbarMsg.value = e.message ?? 'No se pudo guardar'
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    guardando.value = { ...guardando.value, [grupo.id]: false }
  }
}

const nombreUsuario = computed(() => user.value?.email ?? '')
</script>

<template>
  <v-container class="py-6" style="max-width: 720px">
    <div class="d-flex align-center mb-4">
      <v-btn :icon="mdiChevronLeft" variant="text" to="/" class="mr-1" />
      <h1 class="text-h6" style="margin: 0">Administración de grupos</h1>
    </div>

    <!-- Sin sesión -->
    <v-card v-if="!user" rounded="lg">
      <v-card-text class="text-center py-8">
        <p class="mb-4">Iniciá sesión para acceder al panel de administración.</p>
        <v-btn color="primary" variant="flat" @click="authDialog = true">Iniciar sesión</v-btn>
      </v-card-text>
    </v-card>

    <!-- Verificando rol -->
    <v-card v-else-if="verificandoRol || !rolVerificado" rounded="lg">
      <v-card-text class="d-flex justify-center py-8">
        <v-progress-circular indeterminate />
      </v-card-text>
    </v-card>

    <!-- Sin permisos (estudiante, sin rol de staff) -->
    <v-card v-else-if="!tienePermiso" rounded="lg">
      <v-card-text class="text-center py-8">
        <p class="mb-4">Tu cuenta ({{ nombreUsuario }}) no tiene permisos de administrador.</p>
        <v-btn variant="text" @click="signOut">Cerrar sesión</v-btn>
      </v-card-text>
    </v-card>

    <!-- Panel de staff (auxiliar o administrador) -->
    <template v-else>
      <div class="d-flex justify-space-between align-center mb-4">
        <span class="text-caption text-medium-emphasis">
          Conectado como {{ nombreUsuario }} ({{ miRol }})
        </span>
        <v-btn size="small" variant="text" :prepend-icon="mdiLogout" @click="signOut">
          Cerrar sesión
        </v-btn>
      </div>

      <v-card rounded="lg" class="mb-4">
        <v-card-text>
          <v-autocomplete
            v-model="carreraSeleccionada"
            :items="carreras"
            item-title="nombre"
            item-value="id"
            :return-object="true"
            label="Carrera"
            placeholder="Buscar carrera..."
            :loading="cargandoCarreras"
            density="comfortable"
            variant="outlined"
            hide-details
            clearable
            @update:model-value="seleccionarCarrera"
          />

          <v-autocomplete
            v-if="carreraSeleccionada"
            v-model="materiaSeleccionada"
            v-model:search="busquedaMateria"
            :items="materiasFiltradas"
            :no-filter="true"
            item-title="nombre"
            item-value="id"
            :return-object="true"
            label="Materia"
            placeholder="Buscar materia o docente..."
            :loading="cargandoMaterias"
            density="comfortable"
            variant="outlined"
            class="mt-4"
            hide-details
            clearable
            @update:model-value="seleccionarMateria"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item
                v-bind="itemProps"
                :subtitle="
                  docenteQueCoincide(item.raw)
                    ? `Docente: ${docenteQueCoincide(item.raw)}`
                    : undefined
                "
              />
            </template>
          </v-autocomplete>
        </v-card-text>
      </v-card>

      <div v-if="cargandoGrupos" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate />
      </div>

      <template v-else-if="materiaSeleccionada">
        <v-alert v-if="grupos.length === 0" type="info" variant="tonal">
          Esta materia no tiene grupos cargados para la gestión {{ GESTION }}.
        </v-alert>

        <v-card v-for="grupo in grupos" :key="grupo.id" rounded="lg" class="mb-3">
          <v-card-title class="text-subtitle-1">Grupo {{ grupo.numero }}</v-card-title>
          <v-card-text v-if="edicion[grupo.id]">
            <v-text-field
              v-model="edicion[grupo.id]!.aulaVirtual"
              label="Aula virtual (link)"
              placeholder="https://..."
              variant="outlined"
              density="comfortable"
              class="mb-3"
              hide-details
            />
            <v-text-field
              v-model="edicion[grupo.id]!.whatsappGrupo"
              label="Grupo de WhatsApp (link)"
              placeholder="https://chat.whatsapp.com/..."
              variant="outlined"
              density="comfortable"
              hide-details
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              :prepend-icon="mdiContentSave"
              :loading="guardando[grupo.id]"
              @click="guardarGrupo(grupo)"
            >
              Guardar
            </v-btn>
          </v-card-actions>
        </v-card>
      </template>
    </template>

    <auth-dialog v-model="authDialog" />

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="2500">
      {{ snackbarMsg }}
    </v-snackbar>
  </v-container>
</template>
