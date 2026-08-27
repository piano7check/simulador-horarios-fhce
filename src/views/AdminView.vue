<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  mdiChevronLeft,
  mdiContentSave,
  mdiLogout,
  mdiAccountCog,
  mdiAccountRemoveOutline,
  mdiAccountSchool,
} from '@mdi/js'
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
  listarEstudiantes,
  buscarUsuarios,
  asignarRol,
  quitarRol,
  type GrupoAdmin,
  type RolUsuario,
  type UsuarioConRol,
  type UsuarioEncontrado,
  type Estudiante,
} from '@/services/admin'
import { normalizarTexto } from '@/utils/texto'

const GESTION = GESTION_ACTUAL
const FACULTAD_ID = 1

const { user, signOut } = useAuth()
const router = useRouter()
const authDialog = ref(false)

/** Al cerrar sesión, volver a la vista inicial (elegir carrera) en vez de
 * quedarse en /admin ya sin permisos. */
async function cerrarSesion() {
  await signOut()
  router.push('/')
}

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

// -- Pestañas del panel (Roles y Estudiantes solo aparecen para administrador) --
const tabActiva = ref<'grupos' | 'roles' | 'estudiantes'>('grupos')

// -- Gestión de roles (solo administrador) --
const ROLES_DISPONIBLES: RolUsuario[] = ['auxiliar', 'docente', 'administrador']
const usuariosConRol = ref<UsuarioConRol[]>([])
const cargandoUsuariosConRol = ref(false)
const rolAAsignar = ref<RolUsuario>('auxiliar')
const asignandoRol = ref(false)
const quitandoRol = ref<Record<string, boolean>>({})

// Búsqueda por nombre o correo, para elegir a quién asignar el rol.
const busquedaUsuario = ref('')
const resultadosBusqueda = ref<UsuarioEncontrado[]>([])
const buscandoUsuarios = ref(false)
const usuarioSeleccionado = ref<UsuarioEncontrado | null>(null)

function etiquetaUsuario(u: UsuarioEncontrado) {
  return u.nombre ? `${u.nombre} — ${u.email}` : u.email
}

let timeoutBusquedaUsuario: ReturnType<typeof setTimeout> | undefined
function onBusquedaUsuario(termino: string) {
  clearTimeout(timeoutBusquedaUsuario)
  if (!termino || termino.trim().length < 2) {
    resultadosBusqueda.value = []
    return
  }
  timeoutBusquedaUsuario = setTimeout(async () => {
    buscandoUsuarios.value = true
    try {
      resultadosBusqueda.value = await buscarUsuarios(termino.trim())
    } catch {
      resultadosBusqueda.value = []
    } finally {
      buscandoUsuarios.value = false
    }
  }, 300)
}

const headersRoles = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Correo', key: 'email' },
  { title: 'Rol', key: 'rol' },
  { title: 'Ingresos', key: 'ingresos', align: 'end' as const },
  { title: 'Vistas', key: 'vistas', align: 'end' as const },
  { title: 'Último ingreso', key: 'ultimo_ingreso' },
  { title: '', key: 'acciones', sortable: false, align: 'end' as const },
]

function formatUltimoIngreso(ts: string | null) {
  if (!ts) return 'Nunca'
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return 'Desconocido'
  }
}

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

// -- Estudiantes (solo administrador) --
const headersEstudiantes = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Correo', key: 'email' },
  { title: 'Ingresos', key: 'ingresos', align: 'end' as const },
  { title: 'Vistas', key: 'vistas', align: 'end' as const },
  { title: 'Último ingreso', key: 'ultimo_ingreso' },
]
const estudiantes = ref<Estudiante[]>([])
const cargandoEstudiantes = ref(false)
const busquedaEstudiante = ref('')

async function cargarEstudiantes() {
  cargandoEstudiantes.value = true
  try {
    estudiantes.value = await listarEstudiantes()
  } catch (e: any) {
    snackbarMsg.value = e.message ?? 'No se pudo cargar la lista de estudiantes'
    snackbarColor.value = 'error'
    snackbar.value = true
  } finally {
    cargandoEstudiantes.value = false
  }
}

watch(tabActiva, (tab) => {
  if (tab === 'roles') cargarUsuariosConRol()
  if (tab === 'estudiantes') cargarEstudiantes()
})

async function asignarRolAUsuarioSeleccionado() {
  const usuario = usuarioSeleccionado.value
  if (!usuario) return
  asignandoRol.value = true
  try {
    await asignarRol(usuario.user_id, rolAAsignar.value)
    snackbarMsg.value = `Rol "${rolAAsignar.value}" asignado a ${etiquetaUsuario(usuario)}`
    snackbarColor.value = 'success'
    snackbar.value = true
    usuarioSeleccionado.value = null
    busquedaUsuario.value = ''
    resultadosBusqueda.value = []
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
  <v-container
    class="py-6"
    :style="{
      maxWidth: tabActiva === 'roles' || tabActiva === 'estudiantes' ? '960px' : '720px',
    }"
  >
    <div class="d-flex align-center mb-4">
      <v-btn :icon="mdiChevronLeft" variant="text" to="/" class="mr-1" />
      <h1 class="text-h6" style="margin: 0">Administración</h1>
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
        <v-btn variant="text" @click="cerrarSesion">Cerrar sesión</v-btn>
      </v-card-text>
    </v-card>

    <!-- Panel de staff (auxiliar o administrador) -->
    <template v-else>
      <div class="d-flex justify-space-between align-center mb-4">
        <span class="text-caption text-medium-emphasis">
          Conectado como {{ nombreUsuario }} ({{ miRol }})
        </span>
        <v-btn size="small" variant="text" :prepend-icon="mdiLogout" @click="cerrarSesion">
          Cerrar sesión
        </v-btn>
      </div>

      <v-tabs v-if="esAdministrador" v-model="tabActiva" class="mb-4">
        <v-tab value="grupos">Grupos</v-tab>
        <v-tab value="roles" :prepend-icon="mdiAccountCog">Roles</v-tab>
        <v-tab value="estudiantes" :prepend-icon="mdiAccountSchool">Estudiantes</v-tab>
      </v-tabs>

      <v-window v-model="tabActiva">
        <v-window-item value="grupos">
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

          <v-alert
            v-else-if="materiaSeleccionada && grupos.length === 0"
            type="info"
            variant="tonal"
          >
            Esta materia no tiene grupos cargados para la gestión {{ GESTION }}.
          </v-alert>

          <v-card v-else-if="grupoSeleccionado" rounded="lg" class="mb-3">
            <v-card-title class="text-subtitle-1"
              >Grupo {{ grupoSeleccionado.numero }}</v-card-title
            >
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
        </v-window-item>

        <v-window-item v-if="esAdministrador" value="roles">
          <v-card rounded="lg">
            <v-card-text>
              <div class="d-flex flex-wrap ga-2 align-start mb-4">
                <v-autocomplete
                  v-model="usuarioSeleccionado"
                  v-model:search="busquedaUsuario"
                  :items="resultadosBusqueda"
                  :loading="buscandoUsuarios"
                  :item-title="etiquetaUsuario"
                  item-value="user_id"
                  return-object
                  no-filter
                  clearable
                  label="Buscar por nombre o correo"
                  placeholder="Escribe al menos 2 letras..."
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  style="min-width: 260px; flex: 1 1 260px"
                  @update:search="onBusquedaUsuario"
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
                  :disabled="!usuarioSeleccionado"
                  :loading="asignandoRol"
                  @click="asignarRolAUsuarioSeleccionado"
                >
                  Asignar
                </v-btn>
              </div>
              <p class="text-caption text-medium-emphasis mb-4">
                La cuenta debe haber iniciado sesión al menos una vez en la app. Si ya tiene un
                rol, se reemplaza por el nuevo.
              </p>

              <v-divider class="mb-4" />

              <div v-if="cargandoUsuariosConRol" class="d-flex justify-center py-4">
                <v-progress-circular indeterminate />
              </div>
              <v-alert v-else-if="usuariosConRol.length === 0" type="info" variant="tonal">
                Todavía no hay usuarios con roles asignados.
              </v-alert>
              <v-data-table
                :headers="headersRoles"
                :items="usuariosConRol"
                item-value="user_id"
                density="comfortable"
                :items-per-page="10"
                mobile-breakpoint="sm"
                class="roles-table"
              >
                <template #item.nombre="{ item }">
                  {{ item.nombre ?? '—' }}
                </template>
                <template #item.ultimo_ingreso="{ item }">
                  {{ formatUltimoIngreso(item.ultimo_ingreso) }}
                </template>
                <template #item.acciones="{ item }">
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    :loading="quitandoRol[item.user_id]"
                    title="Quitar rol"
                    @click="quitarRolAUsuario(item)"
                  >
                    <v-icon :icon="mdiAccountRemoveOutline" size="20" />
                  </v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-window-item>

        <v-window-item v-if="esAdministrador" value="estudiantes">
          <v-card rounded="lg">
            <v-card-text>
              <v-text-field
                v-model="busquedaEstudiante"
                label="Buscar por nombre o correo"
                variant="outlined"
                density="comfortable"
                hide-details
                clearable
                class="mb-4"
              />

              <div v-if="cargandoEstudiantes" class="d-flex justify-center py-4">
                <v-progress-circular indeterminate />
              </div>
              <v-alert v-else-if="estudiantes.length === 0" type="info" variant="tonal">
                Todavía no hay estudiantes registrados.
              </v-alert>
              <v-data-table
                v-else
                :headers="headersEstudiantes"
                :items="estudiantes"
                :search="busquedaEstudiante"
                item-value="user_id"
                density="comfortable"
                :items-per-page="10"
                mobile-breakpoint="sm"
                class="roles-table"
              >
                <template #item.nombre="{ item }">
                  {{ item.nombre ?? '—' }}
                </template>
                <template #item.ultimo_ingreso="{ item }">
                  {{ formatUltimoIngreso(item.ultimo_ingreso) }}
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <auth-dialog v-model="authDialog" />

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="2500">
      {{ snackbarMsg }}
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.roles-table :deep(td),
.roles-table :deep(th) {
  white-space: nowrap;
}
</style>
