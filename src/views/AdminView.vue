<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { mdiChevronLeft, mdiContentSave, mdiLogout, mdiAccountCog } from '@mdi/js'
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
  listarRolesUsuario,
  buscarUsuarioPorEmail,
  asignarRol,
  quitarRol,
  type GrupoAdmin,
  type RolUsuario,
  type UsuarioConRol,
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
const esAdministrador = computed(() => miRol.value === 'administrador')

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
const grupoSeleccionado = ref<GrupoAdmin | null>(null)

// Edición local por grupo, para no pisar lo cargado en el server mientras
// el admin todavía está escribiendo.
const edicion = ref<
  Record<number, { aulaVirtual: string; whatsappDocente: string; whatsappAuxiliar: string }>
>({})
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
  grupoSeleccionado.value = null
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
  grupoSeleccionado.value = null
  if (!materia) return
  cargandoGrupos.value = true
  try {
    grupos.value = await obtenerGruposAdmin(materia.id, GESTION)
    edicion.value = Object.fromEntries(
      grupos.value.map((g) => [
        g.id,
        {
          aulaVirtual: g.aula_virtual ?? '',
          whatsappDocente: g.whatsapp_docente ?? '',
          whatsappAuxiliar: g.whatsapp_auxiliar ?? '',
        },
      ]),
    )
    // Si la materia tiene un solo grupo, se selecciona directo — no hace
    // falta hacer elegir algo que no tiene otra opción.
    if (grupos.value.length === 1) grupoSeleccionado.value = grupos.value[0]!
  } finally {
    cargandoGrupos.value = false
  }
}

function seleccionarGrupo(grupo: GrupoAdmin | null) {
  grupoSeleccionado.value = grupo
}

async function guardarGrupo(grupo: GrupoAdmin) {
  const datos = edicion.value[grupo.id]
  if (!datos) return
  guardando.value = { ...guardando.value, [grupo.id]: true }
  try {
    await actualizarGrupoExtra(grupo.id, {
      aulaVirtual: datos.aulaVirtual.trim() || null,
      whatsappDocente: datos.whatsappDocente.trim() || null,
      whatsappAuxiliar: datos.whatsappAuxiliar.trim() || null,
    })
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

// -- Gestión de roles (solo administrador) --
const ROLES_DISPONIBLES: RolUsuario[] = ['auxiliar', 'docente', 'administrador']
const dialogRoles = ref(false)
const usuariosConRol = ref<UsuarioConRol[]>([])
const cargandoUsuariosConRol = ref(false)
const emailBusqueda = ref('')
const rolAAsignar = ref<RolUsuario>('auxiliar')
const asignandoRol = ref(false)
const quitandoRol = ref<Record<string, boolean>>({})

async function cargarUsuariosConRol() {
  cargandoUsuariosConRol.value = true
  try {
    usuariosConRol.value = await listarRolesUsuario()
  } catch (e: any) {
    snackbarMsg.value = e.message ?? 'No se pudo cargar la lista de roles'
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    cargandoUsuariosConRol.value = false
  }
}

async function abrirDialogRoles() {
  dialogRoles.value = true
  await cargarUsuariosConRol()
}

async function asignarRolPorEmail() {
  const email = emailBusqueda.value.trim()
  if (!email) return
  asignandoRol.value = true
  try {
    const usuario = await buscarUsuarioPorEmail(email)
    if (!usuario) {
      snackbarMsg.value =
        'No se encontró ninguna cuenta con ese correo (debe haber iniciado sesión al menos una vez)'
      snackbarColor.value = 'error'
      snackbar.value = true
      return
    }
    await asignarRol(usuario.user_id, rolAAsignar.value)
    snackbarMsg.value = `Rol "${rolAAsignar.value}" asignado a ${usuario.email}`
    snackbarColor.value = 'success'
    snackbar.value = true
    emailBusqueda.value = ''
    await cargarUsuariosConRol()
  } catch (e: any) {
    snackbarMsg.value = e.message ?? 'No se pudo asignar el rol'
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    asignandoRol.value = false
  }
}

async function quitarRolAUsuario(usuario: UsuarioConRol) {
  quitandoRol.value = { ...quitandoRol.value, [usuario.user_id]: true }
  try {
    await quitarRol(usuario.user_id)
    snackbarMsg.value = `Se quitó el rol a ${usuario.email}`
    snackbarColor.value = 'success'
    snackbar.value = true
    await cargarUsuariosConRol()
  } catch (e: any) {
    snackbarMsg.value = e.message ?? 'No se pudo quitar el rol'
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    quitandoRol.value = { ...quitandoRol.value, [usuario.user_id]: false }
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
        <div>
          <v-btn
            v-if="esAdministrador"
            size="small"
            variant="text"
            :prepend-icon="mdiAccountCog"
            @click="abrirDialogRoles"
          >
            Gestionar roles
          </v-btn>
          <v-btn size="small" variant="text" :prepend-icon="mdiLogout" @click="signOut">
            Cerrar sesión
          </v-btn>
        </div>
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

          <v-select
            v-if="materiaSeleccionada && !cargandoGrupos && grupos.length > 0"
            :model-value="grupoSeleccionado"
            :items="grupos"
            :item-title="(g: GrupoAdmin) => `Grupo ${g.numero}`"
            item-value="id"
            :return-object="true"
            label="Grupo"
            density="comfortable"
            variant="outlined"
            class="mt-4"
            hide-details
            @update:model-value="seleccionarGrupo"
          />
        </v-card-text>
      </v-card>

      <div v-if="cargandoGrupos" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate />
      </div>

      <v-alert v-else-if="materiaSeleccionada && grupos.length === 0" type="info" variant="tonal">
        Esta materia no tiene grupos cargados para la gestión {{ GESTION }}.
      </v-alert>

      <v-card v-else-if="grupoSeleccionado" rounded="lg" class="mb-3">
        <v-card-title class="text-subtitle-1">Grupo {{ grupoSeleccionado.numero }}</v-card-title>
        <v-card-text v-if="edicion[grupoSeleccionado.id]">
          <v-text-field
            v-model="edicion[grupoSeleccionado.id]!.aulaVirtual"
            label="Aula virtual - Classroom o Moodle (link)"
            placeholder="https://classroom.google.com/... o https://moodle..."
            variant="outlined"
            density="comfortable"
            class="mb-3"
            hide-details
          />
          <v-text-field
            v-model="edicion[grupoSeleccionado.id]!.whatsappDocente"
            label="Grupo de WhatsApp - Docente (link)"
            placeholder="https://chat.whatsapp.com/..."
            variant="outlined"
            density="comfortable"
            class="mb-3"
            hide-details
          />
          <v-text-field
            v-model="edicion[grupoSeleccionado.id]!.whatsappAuxiliar"
            label="Grupo de WhatsApp - Auxiliar (link)"
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
            :loading="guardando[grupoSeleccionado.id]"
            @click="guardarGrupo(grupoSeleccionado)"
          >
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>

    <auth-dialog v-model="authDialog" />

    <v-dialog v-model="dialogRoles" max-width="560">
      <v-card rounded="lg">
        <v-card-title>Gestión de roles</v-card-title>
        <v-card-text>
          <div class="d-flex flex-wrap ga-2 align-start mb-4">
            <v-text-field
              v-model="emailBusqueda"
              label="Correo del usuario"
              placeholder="usuario@est.umss.edu"
              variant="outlined"
              density="comfortable"
              hide-details
              style="min-width: 220px; flex: 1 1 220px"
              @keyup.enter="asignarRolPorEmail"
            />
            <v-select
              v-model="rolAAsignar"
              :items="ROLES_DISPONIBLES"
              label="Rol"
              variant="outlined"
              density="comfortable"
              hide-details
              style="max-width: 160px"
            />
            <v-btn
              color="primary"
              variant="flat"
              :loading="asignandoRol"
              @click="asignarRolPorEmail"
            >
              Asignar
            </v-btn>
          </div>
          <p class="text-caption text-medium-emphasis mb-4">
            La cuenta debe haber iniciado sesión al menos una vez en la app. Si el correo ya tiene
            un rol, se reemplaza por el nuevo.
          </p>

          <v-divider class="mb-4" />

          <div v-if="cargandoUsuariosConRol" class="d-flex justify-center py-4">
            <v-progress-circular indeterminate />
          </div>
          <v-alert v-else-if="usuariosConRol.length === 0" type="info" variant="tonal">
            Todavía no hay usuarios con roles asignados.
          </v-alert>
          <v-list v-else density="compact">
            <v-list-item v-for="u in usuariosConRol" :key="u.user_id">
              <v-list-item-title>{{ u.email }}</v-list-item-title>
              <v-list-item-subtitle>{{ u.rol }}</v-list-item-subtitle>
              <template #append>
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  :loading="quitandoRol[u.user_id]"
                  @click="quitarRolAUsuario(u)"
                >
                  Quitar
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogRoles = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="2500">
      {{ snackbarMsg }}
    </v-snackbar>
  </v-container>
</template>
