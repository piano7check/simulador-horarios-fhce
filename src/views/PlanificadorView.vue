<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'
import { obtenerMaterias, obtenerClases, type Materia, type Clase } from '@/services/horarios'
import {
  mdiChevronLeft,
  mdiBookOpenVariant,
  mdiChevronDown,
  mdiChevronRight,
  mdiPlus,
  mdiDeleteSweep,
  mdiPrinter,
  mdiFilePdfBox,
  mdiFileImageOutline,
  mdiHelpCircle,
  mdiContentSave,
} from '@mdi/js'
import SemanaView from '@/components/SemanaView.vue'
import AuthDialog from '@/components/AuthDialog.vue'
import { useAuth } from '@/composables/useAuth'
import { cargarHorario, guardarHorario } from '@/services/horarioGuardado'

const route = useRoute()
const carrera = route.params.carrera as string
const carreraId = Number(route.query.id)

// Nombre legible de la carrera: preferir el que viene en la query (con
// acentos y mayúsculas correctas) y usar el slug de la URL solo como
// respaldo si alguien entra con un link viejo sin ese parámetro.
function capitalizarSlug(slug: string) {
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ')
}
const nombreCarreraQuery = route.query.nombre
const nombreCarreraLegible =
  typeof nombreCarreraQuery === 'string' && nombreCarreraQuery.trim()
    ? nombreCarreraQuery
    : capitalizarSlug(carrera)
const STORAGE_KEY_BORRADOR = `horario_pendiente_${carreraId}`

// TODO: hacerlo dinámico
const GESTION = '2/2026'

const materias = ref<Materia[]>([])
const cargando = ref(true)
const errorMsg = ref('')
const lastScraped = ref<string | null>(null)
const helpDialog = ref(false)

// Sidebar: nivel seleccionado y materias expandidas
const nivelActivo = ref<string | null>(null)
const materiasExpandidas = ref(new Set<number>())
const clasesCache = ref<Record<number, Clase[]>>({})
const cargandoClases = ref<Record<number, boolean>>({})

// Grupos seleccionados (checkbox): clave "materiaId-grupoNumero"
const gruposSeleccionados = ref(new Set<string>())

// Mobile: panel inferior visible
const panelMobileAbierto = ref(true)

const mostrarMensajeExportacion = ref(false)

// display helpers
const { mobile } = useDisplay()

const { user } = useAuth()
const guardando = ref(false)
const snackbarGuardado = ref(false)
const snackbarGuardadoMsg = ref('')
const authDialog = ref(false)
const dialogHorarioGuardado = ref(false)
const gruposGuardadosPendientes = ref<string[]>([])
const guardarPendiente = ref(false)
const dialogReemplazarHorario = ref(false)

function obtenerNombreRegistrado(meta: Record<string, unknown>): string | undefined {
  const posiblesNombres = [
    meta.nombre_completo,
    meta.full_name,
    meta.display_name,
    meta.name,
    meta.nombre,
  ]
  for (const valor of posiblesNombres) {
    if (typeof valor === 'string' && valor.trim().length > 0) return valor.trim()
  }

  const givenName = typeof meta.given_name === 'string' ? meta.given_name.trim() : ''
  const familyName = typeof meta.family_name === 'string' ? meta.family_name.trim() : ''
  const combinado = `${givenName} ${familyName}`.trim()
  return combinado || undefined
}

const estudianteRegistrado = computed(() => {
  const u = user.value
  if (!u) return undefined
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  return obtenerNombreRegistrado(meta) ?? 'No registrado'
})

// Acción: quitar todos los grupos seleccionados
function quitarTodo() {
  gruposSeleccionados.value = new Set()
}

async function cargarHorarioGuardado() {
  if (!user.value) return
  try {
    const grupos = await cargarHorario(user.value.id, carreraId)
    if (grupos.length === 0) return
    const materiaIds = [...new Set(grupos.map((k) => Number(k.split('-')[0])))]
    await Promise.all(
      materiaIds.map(async (mid) => {
        if (!clasesCache.value[mid]) {
          try {
            clasesCache.value[mid] = await obtenerClases(mid, GESTION)
          } catch {
            clasesCache.value[mid] = []
          }
        }
      }),
    )
    gruposSeleccionados.value = new Set(grupos)
  } catch {
    // el horario guardado es opcional
  }
}

function sonMismosGrupos(actuales: Set<string>, guardados: string[]) {
  if (actuales.size !== guardados.length) return false
  for (const g of guardados) if (!actuales.has(g)) return false
  return true
}

async function precargarClasesParaGrupos(grupos: string[]) {
  const materiaIds = [...new Set(grupos.map((k) => Number(k.split('-')[0])))]
  await Promise.all(
    materiaIds.map(async (mid) => {
      if (!clasesCache.value[mid]) {
        try {
          clasesCache.value[mid] = await obtenerClases(mid, GESTION)
        } catch {
          clasesCache.value[mid] = []
        }
      }
    }),
  )
}

async function evaluarHorarioGuardadoEnLogin() {
  if (!user.value) return
  try {
    const gruposGuardados = await cargarHorario(user.value.id, carreraId)
    if (gruposGuardados.length === 0) return

    await precargarClasesParaGrupos(gruposGuardados)

    if (gruposSeleccionados.value.size === 0) {
      gruposSeleccionados.value = new Set(gruposGuardados)
      return
    }

    if (sonMismosGrupos(gruposSeleccionados.value, gruposGuardados)) return

    gruposGuardadosPendientes.value = gruposGuardados
    dialogHorarioGuardado.value = true
  } catch {
    // el horario guardado es opcional
  }
}

function usarHorarioGuardado() {
  gruposSeleccionados.value = new Set(gruposGuardadosPendientes.value)
  gruposGuardadosPendientes.value = []
  dialogHorarioGuardado.value = false
  snackbarGuardadoMsg.value = 'Se cargó tu horario guardado'
  snackbarGuardado.value = true
}

function mantenerHorarioActual() {
  gruposGuardadosPendientes.value = []
  dialogHorarioGuardado.value = false
  snackbarGuardadoMsg.value = 'Se mantuvo tu horario actual'
  snackbarGuardado.value = true
}

async function evaluarConflictoAntesDeGuardar() {
  if (!user.value) return
  try {
    const gruposGuardados = await cargarHorario(user.value.id, carreraId)
    if (gruposGuardados.length === 0 || sonMismosGrupos(gruposSeleccionados.value, gruposGuardados)) {
      await guardar()
      return
    }
    gruposGuardadosPendientes.value = gruposGuardados
    dialogReemplazarHorario.value = true
  } catch {
    await guardar()
  }
}

function reemplazarHorarioGuardado() {
  gruposGuardadosPendientes.value = []
  dialogReemplazarHorario.value = false
  guardar()
}

function usarHorarioGuardadoExistente() {
  gruposSeleccionados.value = new Set(gruposGuardadosPendientes.value)
  gruposGuardadosPendientes.value = []
  dialogReemplazarHorario.value = false
  sessionStorage.removeItem(STORAGE_KEY_BORRADOR)
  snackbarGuardadoMsg.value = 'Se cargó tu horario guardado'
  snackbarGuardado.value = true
}

async function guardar() {
  if (!user.value) {
    guardarPendiente.value = true
    // El login con Google recarga la página completa (redirección estándar),
    // así que el estado en memoria se pierde — se restaura en onMounted.
    sessionStorage.setItem(STORAGE_KEY_BORRADOR, JSON.stringify([...gruposSeleccionados.value]))
    helpDialog.value = false
    authDialog.value = true
    return
  }
  guardando.value = true
  try {
    await guardarHorario(user.value.id, carreraId, [...gruposSeleccionados.value])
    sessionStorage.removeItem(STORAGE_KEY_BORRADOR)
    snackbarGuardadoMsg.value = 'Horario guardado'
    snackbarGuardado.value = true
  } catch {
    snackbarGuardadoMsg.value = 'Error al guardar'
    snackbarGuardado.value = true
  } finally {
    guardando.value = false
  }
}

watch(user, async (newUser) => {
  if (!newUser) return
  if (guardarPendiente.value) {
    guardarPendiente.value = false
    await evaluarConflictoAntesDeGuardar()
    return
  }
  if (materias.value.length > 0) await evaluarHorarioGuardadoEnLogin()
})

// Ref al componente SemanaView para llamar sus métodos expuestos
const semanaRef = ref<InstanceType<typeof SemanaView> | null>(null)
const semanaRefMobile = ref<InstanceType<typeof SemanaView> | null>(null)
const semanaExportar = computed(() => (mobile.value ? semanaRefMobile.value : semanaRef.value))

// Nombre legible de la carrera
const nombreCarrera = computed(() => nombreCarreraLegible)

// Subtítulo de nivel: solo si TODOS los cursos seleccionados pertenecen del mismo nivel
const nombreNivel = computed(() => {
  if (cursosSeleccionados.value.length === 0) return undefined
  const nivelesSet = new Set<string>()
  for (const curso of cursosSeleccionados.value) {
    const mat = materias.value.find((m) => m.id === Number(curso.key.split('-')[0]))
    if (mat) nivelesSet.add(mat.nivel_nombre)
  }
  return nivelesSet.size === 1 ? [...nivelesSet][0] : undefined
})

function descargarPDF() {
  const target = semanaExportar.value
  if (!target?.descargarPDF) {
    mostrarMensajeExportacion.value = true
    return
  }
  target.descargarPDF()
}

function descargarImagen() {
  const target = semanaExportar.value
  if (!target?.descargarImagen) {
    mostrarMensajeExportacion.value = true
    return
  }
  target.descargarImagen()
}

function imprimir() {
  const target = semanaExportar.value
  if (!target?.imprimir) {
    mostrarMensajeExportacion.value = true
    return
  }
  target.imprimir()
}

// Agrupar materias por nivel
interface Nivel {
  codigo: string
  nombre: string
  materias: Materia[]
}

const niveles = computed<Nivel[]>(() => {
  const map = new Map<string, Nivel>()
  for (const m of materias.value) {
    if (!map.has(m.nivel_codigo)) {
      map.set(m.nivel_codigo, { codigo: m.nivel_codigo, nombre: m.nivel_nombre, materias: [] })
    }
    map.get(m.nivel_codigo)!.materias.push(m)
  }
  return Array.from(map.values())
})

// Extraer grupos únicos de las clases cacheadas de una materia

function gruposDeMateria(materiaId: number): { numero: string; docente: string }[] {
  const clases = clasesCache.value[materiaId] ?? []
  const map = new Map<string, string>()
  for (const c of clases) {
    if (!map.has(c.grupo_numero)) map.set(c.grupo_numero, c.docente)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([numero, docente]) => ({ numero, docente }))
}

function grupoKey(materiaId: number, grupoNumero: string) {
  return `${materiaId}-${grupoNumero}`
}

function isGrupoSeleccionado(materiaId: number, grupoNumero: string) {
  return gruposSeleccionados.value.has(grupoKey(materiaId, grupoNumero))
}

function toggleGrupo(materiaId: number, grupoNumero: string) {
  const key = grupoKey(materiaId, grupoNumero)
  const next = new Set(gruposSeleccionados.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  gruposSeleccionados.value = next
}

// Datos para la vista principal: todos los grupos seleccionados con su info

interface GrupoSeleccionado {
  key: string
  materiaNombre: string
  materiaCodigo: string
  grupoNumero: string
  clases: Clase[]
}

const cursosSeleccionados = computed<GrupoSeleccionado[]>(() => {
  const result: GrupoSeleccionado[] = []
  for (const key of gruposSeleccionados.value) {
    const [matIdStr, grpStr] = key.split('-')
    const materiaId = Number(matIdStr)
    const grupoNumero = grpStr ?? ''
    const mat = materias.value.find((m) => m.id === materiaId)
    if (!mat) continue
    const clases = (clasesCache.value[materiaId] ?? []).filter(
      (c) => c.grupo_numero === grupoNumero,
    )
    result.push({
      key,
      materiaNombre: mat.nombre,
      materiaCodigo: mat.codigo,
      grupoNumero,
      clases,
    })
  }
  return result.sort((a, b) => a.materiaNombre.localeCompare(b.materiaNombre))
})

onMounted(async () => {
  try {
    materias.value = await obtenerMaterias(carreraId)
    // No realizar nuevas consultas: leer last_scraped desde la ruta si viene en query
    const q = route.query
    const val = (q.last_scraped ?? q.lastScraped) as string | undefined
    lastScraped.value = val ?? null

    // Restaurar un borrador pendiente de guardar (ej. tras volver de un login
    // con Google, que recarga la página completa y borra el estado en memoria).
    const borrador = sessionStorage.getItem(STORAGE_KEY_BORRADOR)
    let seRestauroBorrador = false
    if (borrador) {
      sessionStorage.removeItem(STORAGE_KEY_BORRADOR)
      try {
        const grupos: string[] = JSON.parse(borrador)
        if (grupos.length > 0) {
          await precargarClasesParaGrupos(grupos)
          gruposSeleccionados.value = new Set(grupos)
          seRestauroBorrador = true
        }
      } catch {
        // borrador corrupto, se ignora
      }
    }

    if (seRestauroBorrador) {
      if (user.value) {
        // Ya hay sesión (volvimos de la redirección de Google): completar el guardado.
        await evaluarConflictoAntesDeGuardar()
      } else {
        // Login por email/password en curso (no recarga la página): el watch(user, …)
        // ya se encarga de completar el guardado apenas se abra la sesión.
        guardarPendiente.value = true
      }
    } else {
      await cargarHorarioGuardado()
    }
  } catch {
    errorMsg.value = 'No se pudieron cargar las materias'
  } finally {
    cargando.value = false
  }
})

function formatScraped(ts: string | null) {
  if (!ts) return 'Desconocida'
  try {
    const d = new Date(ts)
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return 'Desconocida'
  }
}

function seleccionarNivel(codigo: string) {
  nivelActivo.value = nivelActivo.value === codigo ? null : codigo
}

async function toggleMateria(materia: Materia) {
  const expandidas = new Set(materiasExpandidas.value)
  if (expandidas.has(materia.id)) {
    expandidas.delete(materia.id)
    materiasExpandidas.value = expandidas
    return
  }
  expandidas.add(materia.id)
  materiasExpandidas.value = expandidas

  if (!clasesCache.value[materia.id]) {
    cargandoClases.value = { ...cargandoClases.value, [materia.id]: true }
    try {
      clasesCache.value[materia.id] = await obtenerClases(materia.id, GESTION)
    } catch {
      clasesCache.value[materia.id] = []
    } finally {
      cargandoClases.value = { ...cargandoClases.value, [materia.id]: false }
    }
  }
}
</script>

<template>
  <auth-dialog v-model="authDialog" />

  <v-dialog v-model="dialogHorarioGuardado" max-width="520" persistent>
    <v-card rounded="lg">
      <v-card-item class="dialog-header">
        <v-card-title class="text-white">Encontramos un horario guardado</v-card-title>
      </v-card-item>
      <v-card-text class="pt-4 dialog-text">
        Ya tienes un horario guardado para esta carrera. ¿Qué deseas hacer?
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="mantenerHorarioActual">Mantener horario actual</v-btn>
        <v-btn color="primary" variant="flat" @click="usarHorarioGuardado">Mostrar horario guardado</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="dialogReemplazarHorario" max-width="520" persistent>
    <v-card rounded="lg">
      <v-card-item class="dialog-header">
        <v-card-title class="text-white">Ya tienes un horario guardado</v-card-title>
      </v-card-item>
      <v-card-text class="pt-4 dialog-text">
        Tenías otro horario guardado para esta carrera, distinto al que armaste ahora.
        ¿Querés reemplazarlo con este, o mantener el que ya estaba guardado?
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="usarHorarioGuardadoExistente">Mantener el guardado</v-btn>
        <v-btn color="primary" variant="flat" @click="reemplazarHorarioGuardado">Reemplazar con este</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ════════ DESKTOP ════════ -->
  <v-layout class="d-none d-md-flex" style="height: 100%">
    <!-- Sidebar izquierdo -->
    <v-navigation-drawer permanent width="320">
      <v-toolbar density="compact" flat class="topbar-unificada" color="#4285f4" theme="dark">
        <v-btn :icon="mdiChevronLeft" variant="text" size="small" to="/" class="topbar-unificada__icon" />
        <v-toolbar-title class="text-subtitle-1 text-truncate">
          {{ nombreCarreraLegible }}
        </v-toolbar-title>
      </v-toolbar>
      <div class="sidebar-gestion text-caption text-medium-emphasis px-4 py-2">{{ GESTION }}</div>

      <v-divider />

      <div class="materias-hint px-4 pt-2 pb-1">
        <span class="materias-hint__nivel">Semestre</span>
        <span class="materias-hint__arrow">→</span>
        <span class="materias-hint__materia">Materia</span>
        <span class="materias-hint__arrow">→</span>
        <span>Grupo</span>
      </div>

      <div v-if="cargando" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate size="32" />
      </div>

      <v-alert v-else-if="errorMsg" type="error" variant="tonal" class="ma-2">
        {{ errorMsg }}
      </v-alert>

      <v-list v-else density="compact" nav class="materias-panel">
        <template v-for="nivel in niveles" :key="nivel.codigo">
          <!-- Nivel: se ve como un botón/chip (fondo tonal + esquinas
               redondeadas) en vez de solo texto, para que quede claro que
               se puede tocar -->
          <v-list-item
            :active="nivelActivo === nivel.codigo"
            color="primary"
            variant="tonal"
            rounded="lg"
            class="mx-1 mb-1 nivel-chip"
            @click="seleccionarNivel(nivel.codigo)"
          >
            <v-list-item-title class="font-weight-medium">
              Semestre {{ nivel.nombre }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ nivel.codigo }}</v-list-item-subtitle>
            <template #append>
              <v-icon :icon="nivelActivo === nivel.codigo ? mdiChevronDown : mdiChevronRight" size="small" />
            </template>
          </v-list-item>

          <!-- Materias del nivel -->
          <v-expand-transition>
            <div v-if="nivelActivo === nivel.codigo">
              <template v-for="materia in nivel.materias" :key="materia.id">
                <!-- Materia (click expande grupos): color naranja bien
                     distinto del azul del semestre, para que se note que
                     es otro nivel de selección -->
                <v-list-item
                  :active="materiasExpandidas.has(materia.id)"
                  color="orange-darken-1"
                  variant="tonal"
                  rounded="lg"
                  class="mx-1 mb-1 pl-6 materia-chip"
                  @click="toggleMateria(materia)"
                >
                  <template #prepend>
                    <v-icon :icon="mdiBookOpenVariant" size="x-small" />
                  </template>
                  <v-list-item-title class="text-body-2">
                    {{ materia.nombre }}
                  </v-list-item-title>
                  <template #append>
                    <v-icon
                      :icon="materiasExpandidas.has(materia.id) ? mdiChevronDown : mdiChevronRight"
                      size="small"
                    />
                  </template>
                </v-list-item>

                <!-- Grupos como checkboxes -->
                <v-expand-transition>
                  <div v-if="materiasExpandidas.has(materia.id)">
                    <div v-if="cargandoClases[materia.id]" class="d-flex justify-center py-2">
                      <v-progress-circular indeterminate size="20" width="2" />
                    </div>
                    <template v-else>
                      <v-checkbox
                        v-for="grupo in gruposDeMateria(materia.id)"
                        :key="grupo.numero"
                        :model-value="isGrupoSeleccionado(materia.id, grupo.numero)"
                        :label="`G ${grupo.numero}: ${grupo.docente}`"
                        density="compact"
                        hide-details
                        class="pl-12"
                        @update:model-value="toggleGrupo(materia.id, grupo.numero)"
                      />
                    </template>
                  </div>
                </v-expand-transition>
              </template>
            </div>
          </v-expand-transition>
        </template>

        <!-- Última actualización y link para reportar (desktop) -->
        <div class="pa-4">
          <div class="text-caption text-medium-emphasis">
            Actualizado por última vez el: {{ formatScraped(lastScraped) }}
          </div>
          <div class="text-caption mt-2">
            <a
              :href="`https://wa.me/59177435817?text=${encodeURIComponent('Tengo un problema con tu app, si me ayudas te invito un café.')}`"
              target="_blank"
              rel="noopener"
              style="text-decoration: underline; color: inherit"
            >
              Reportar un problema
            </a>
            <a
              href="#"
              @click.prevent="helpDialog = true"
              class="text-caption text-medium-emphasis"
              style="text-decoration: underline; color: inherit; margin-left: 12px"
            >
              Necesito ayuda
            </a>
          </div>
        </div>
      </v-list>
    </v-navigation-drawer>

    <!-- Contenido principal desktop -->
    <v-main scrollable>
      <v-container fluid>
        <!-- Barra de acciones desktop -->
        <div v-if="cursosSeleccionados.length > 0" class="d-flex justify-end ga-2 mb-3">
          <v-btn icon variant="outlined" size="small" @click="quitarTodo" title="Quitar todo">
            <v-icon :icon="mdiDeleteSweep" />
          </v-btn>
          <v-btn icon variant="outlined" size="small" @click="imprimir" title="Imprimir">
            <v-icon :icon="mdiPrinter" />
          </v-btn>
          <v-btn icon variant="outlined" size="small" @click="descargarPDF" title="Descargar PDF">
            <v-icon :icon="mdiFilePdfBox" />
          </v-btn>
          <v-btn icon variant="outlined" size="small" @click="descargarImagen" title="Descargar imagen">
            <v-icon :icon="mdiFileImageOutline" />
          </v-btn>
          <v-btn icon variant="outlined" size="small" @click="helpDialog = true" title="Ayuda">
            <v-icon :icon="mdiHelpCircle" />
          </v-btn>
          <v-btn
            icon
            variant="outlined"
            size="small"
            color="success"
            :loading="guardando"
            title="Guardar horario"
            @click="guardar"
          >
            <v-icon :icon="mdiContentSave" />
          </v-btn>
        </div>

        <!-- Sin grupos seleccionados -->
        <div
          v-if="cursosSeleccionados.length === 0"
          class="d-flex flex-column align-center justify-center"
          style="min-height: 60vh"
        >
          <template v-if="materias.length === 0 && !cargando && !errorMsg">
            <v-icon size="64" color="grey-lighten-1">mdi-emoticon-sad-outline</v-icon>
            <p class="text-h6 text-medium-emphasis mt-4 text-center">
              Parece que no encontramos los horarios de esta carrera
            </p>
            <a
              :href="`https://wa.me/59177435817?text=${encodeURIComponent('Tengo un problema con la carrera ' + carrera + ' Y YA CONSULTE SI HAY HORARIOS PUBLICOS PARA MI CARRERA')}`"
              target="_blank"
              rel="noopener"
              style="text-decoration: none; margin-top: 16px"
            >
              <v-btn color="primary" variant="tonal"> Reportar este error </v-btn>
            </a>
          </template>
          <template v-else>
            <v-icon :icon="mdiBookOpenVariant" size="64" color="grey-lighten-1" />
            <p class="text-h6 text-medium-emphasis mt-4">
              Selecciona materias desde el panel izquierdo
            </p>
          </template>
        </div>

        <!-- Cursos seleccionados -->
        <semana-view
          v-else
          ref="semanaRef"
          :cursos="cursosSeleccionados"
          :nombre-carrera="nombreCarrera"
          :nombre-nivel="nombreNivel"
          :gestion="GESTION"
          :estudiante-nombre="estudianteRegistrado"
        />
      </v-container>
    </v-main>
  </v-layout>

  <!-- ════════ MOBILE ════════ -->
  <div class="d-flex d-md-none flex-column" style="height: 100%">
    <!-- Parte superior: cursos seleccionados. Sin nada seleccionado todavía
         no hay horario que scrollear, así que no se fuerza a ocupar el
         espacio restante — se deja ese lugar para el panel de materias. -->
    <div
      :class="cursosSeleccionados.length > 0 ? 'flex-grow-1 overflow-y-auto' : 'flex-shrink-0'"
      style="min-height: 0"
    >
      <!-- Header mobile: título + iconos en una sola fila para ahorrar espacio vertical -->
      <v-toolbar density="compact" flat class="topbar-unificada" color="#4285f4" theme="dark">
        <v-btn :icon="mdiChevronLeft" variant="text" size="small" to="/" class="topbar-unificada__icon" />
        <v-toolbar-title class="text-subtitle-2 text-truncate">
          {{ nombreCarreraLegible }}
        </v-toolbar-title>
        <div v-if="cursosSeleccionados.length > 0" class="d-flex align-center flex-shrink-0">
          <v-btn icon variant="text" density="compact" @click="quitarTodo" title="Quitar todo">
            <v-icon :icon="mdiDeleteSweep" size="18" />
          </v-btn>
          <v-btn icon variant="text" density="compact" @click="imprimir" title="Imprimir">
            <v-icon :icon="mdiPrinter" size="18" />
          </v-btn>
          <v-btn icon variant="text" density="compact" @click="descargarPDF" title="Descargar PDF">
            <v-icon :icon="mdiFilePdfBox" size="18" />
          </v-btn>
          <v-btn icon variant="text" density="compact" @click="descargarImagen" title="Descargar imagen">
            <v-icon :icon="mdiFileImageOutline" size="18" />
          </v-btn>
          <v-btn
            icon
            variant="text"
            density="compact"
            :loading="guardando"
            title="Guardar horario"
            @click="guardar"
          >
            <v-icon :icon="mdiContentSave" size="18" />
          </v-btn>
          <v-btn icon variant="text" density="compact" @click="helpDialog = true" title="Ayuda">
            <v-icon :icon="mdiHelpCircle" size="18" />
          </v-btn>
        </div>
      </v-toolbar>

      <v-container class="px-3 py-2">
        <!-- Sin grupos seleccionados -->
        <div
          v-if="cursosSeleccionados.length === 0"
          class="d-flex flex-column align-center justify-center py-6"
        >
          <template v-if="materias.length === 0 && !cargando && !errorMsg">
            <v-icon size="36" color="grey-lighten-1">mdi-emoticon-sad-outline</v-icon>
            <p class="text-body-2 text-medium-emphasis mt-2 text-center">
              Parece que no encontramos los horarios de esta carrera
            </p>
            <a
              :href="`https://wa.me/59177435817?text=${encodeURIComponent('Tengo un problema con la carrera ' + carrera + ' Y YA CONSULTE SI HAY HORARIOS PUBLICOS PARA MI CARRERA')}`"
              target="_blank"
              rel="noopener"
              style="text-decoration: none; margin-top: 12px"
            >
              <v-btn color="primary" variant="tonal" size="small"> Reportar este error </v-btn>
            </a>
          </template>
          <template v-else>
            <v-icon :icon="mdiBookOpenVariant" size="36" color="grey-lighten-1" />
            <p class="text-body-2 text-medium-emphasis mt-2 text-center">
              Selecciona materias para comenzar
            </p>
          </template>
        </div>

        <!-- Cursos seleccionados -->
        <semana-view
          v-else
          ref="semanaRefMobile"
          :cursos="cursosSeleccionados"
          :nombre-carrera="nombreCarrera"
          :nombre-nivel="nombreNivel"
          :gestion="GESTION"
          :estudiante-nombre="estudianteRegistrado"
        />
      </v-container>
    </div>

    <!-- Última actualización y link para reportar (mobile) -->
    <div class="flex-shrink-0">
      <div class="px-4 pb-2">
        <div class="text-caption text-medium-emphasis">
          Actualizado por última vez el: {{ formatScraped(lastScraped) }}
        </div>
        <div class="text-caption mt-1">
          <a
            :href="`https://wa.me/59177435817?text=${encodeURIComponent('Tengo un problema con tu app, si me ayudas te invito un café.')}`"
            target="_blank"
            rel="noopener"
            style="text-decoration: underline; color: inherit"
          >
            Reportar un problema
          </a>
          <a
            href="#"
            @click.prevent="helpDialog = true"
            class="text-caption text-medium-emphasis"
            style="text-decoration: underline; color: inherit; margin-left: 12px"
          >
            Necesito ayuda
          </a>
        </div>
      </div>
    </div>

    <!-- Toggle panel inferior -->
    <div class="flex-shrink-0">
      <v-btn
        block
        color="primary"
        variant="flat"
        rounded="0"
        density="comfortable"
        class="toggle-materias text-none"
        @click="panelMobileAbierto = !panelMobileAbierto"
      >
        <v-icon :icon="panelMobileAbierto ? mdiChevronDown : mdiPlus" size="18" class="mr-1" />
        {{ panelMobileAbierto ? 'Ocultar materias' : 'Añadir materias' }}
      </v-btn>
    </div>

    <!-- Parte inferior: navegación de materias -->
    <v-expand-transition>
      <div
        v-show="panelMobileAbierto"
        class="flex-shrink-0 overflow-y-auto border-t materias-panel materias-mobile-panel"
        style="max-height: 45vh"
      >
        <div class="materias-hint px-4 pt-2 pb-1">
          <span class="materias-hint__nivel">Semestre</span>
          <span class="materias-hint__arrow">→</span>
          <span class="materias-hint__materia">Materia</span>
          <span class="materias-hint__arrow">→</span>
          <span>Grupo</span>
        </div>

        <div v-if="cargando" class="d-flex justify-center py-4">
          <v-progress-circular indeterminate size="28" />
        </div>

        <v-alert v-else-if="errorMsg" type="error" variant="tonal" class="ma-2" density="compact">
          {{ errorMsg }}
        </v-alert>

        <v-list v-else density="compact" nav>
          <template v-for="nivel in niveles" :key="nivel.codigo">
            <v-list-item
              :active="nivelActivo === nivel.codigo"
              color="primary"
              variant="tonal"
              rounded="lg"
              class="mx-1 mb-1 nivel-chip"
              @click="seleccionarNivel(nivel.codigo)"
            >
              <v-list-item-title class="font-weight-medium">
                {{ nivel.nombre }}
              </v-list-item-title>
              <v-list-item-subtitle>{{ nivel.codigo }}</v-list-item-subtitle>
              <template #append>
                <v-icon :icon="nivelActivo === nivel.codigo ? mdiChevronDown : mdiChevronRight" size="small" />
              </template>
            </v-list-item>

            <v-expand-transition>
              <div v-if="nivelActivo === nivel.codigo">
                <template v-for="materia in nivel.materias" :key="materia.id">
                  <v-list-item
                    :active="materiasExpandidas.has(materia.id)"
                    color="orange-darken-1"
                    variant="tonal"
                    rounded="lg"
                    class="mx-1 mb-1 pl-6 materia-chip"
                    @click="toggleMateria(materia)"
                  >
                    <template #prepend>
                      <v-icon :icon="mdiBookOpenVariant" size="x-small" />
                    </template>
                    <v-list-item-title>
                      {{ materia.nombre }}
                    </v-list-item-title>
                    <template #append>
                      <v-icon
                        :icon="materiasExpandidas.has(materia.id) ? mdiChevronDown : mdiChevronRight"
                        size="small"
                      />
                    </template>
                  </v-list-item>

                  <v-expand-transition>
                    <div v-if="materiasExpandidas.has(materia.id)">
                      <div v-if="cargandoClases[materia.id]" class="d-flex justify-center py-2">
                        <v-progress-circular indeterminate size="18" width="2" />
                      </div>
                      <template v-else>
                        <v-checkbox
                          v-for="grupo in gruposDeMateria(materia.id)"
                          :key="grupo.numero"
                          :model-value="isGrupoSeleccionado(materia.id, grupo.numero)"
                          :label="`G ${grupo.numero}: ${grupo.docente}`"
                          density="compact"
                          hide-details
                          class="pl-12"
                          @update:model-value="toggleGrupo(materia.id, grupo.numero)"
                        />
                      </template>
                    </div>
                  </v-expand-transition>
                </template>
              </div>
            </v-expand-transition>
          </template>
        </v-list>
      </div>
    </v-expand-transition>
  </div>

  <!-- Dialog de ayuda -->
  <v-dialog v-model="helpDialog" persistent max-width="520">
    <v-card rounded="lg">
      <v-card-item class="dialog-header">
        <template #prepend>
          <v-icon :icon="mdiHelpCircle" color="white" />
        </template>
        <v-card-title class="text-white">Ayuda rápida</v-card-title>
      </v-card-item>
      <v-card-text class="pt-4 dialog-text">
        <p class="dialog-section-title mb-2">Armar tu horario</p>
        <ol class="dialog-list mb-4">
          <li>Escoge el semestre con las materias que quieres cursar.</li>
          <li>Selecciona el grupo de cada materia para verlo en el horario.</li>
          <li>¿Tienes un choque? Prueba con otro grupo de alguna materia involucrada.</li>
          <li>Si el choque persiste, quizás debas elegir a qué materia asistir este semestre.</li>
        </ol>

        <v-divider class="mb-4" />

        <p class="dialog-section-title mb-2">Guardar y exportar</p>
        <div class="dialog-action-row">
          <v-btn icon variant="tonal" color="primary" size="small" @click="imprimir">
            <v-icon :icon="mdiPrinter" />
          </v-btn>
          <span>Imprime el horario directamente.</span>
        </div>
        <div class="dialog-action-row">
          <v-btn icon variant="tonal" color="primary" size="small" @click="descargarPDF">
            <v-icon :icon="mdiFilePdfBox" />
          </v-btn>
          <span>Descarga el horario como PDF.</span>
        </div>
        <div class="dialog-action-row">
          <v-btn icon variant="tonal" color="primary" size="small" @click="descargarImagen">
            <v-icon :icon="mdiFileImageOutline" />
          </v-btn>
          <span>Descarga el horario como imagen.</span>
        </div>
        <div class="dialog-action-row dialog-action-row--last">
          <v-btn icon variant="tonal" color="success" size="small" @click="guardar">
            <v-icon :icon="mdiContentSave" />
          </v-btn>
          <span>
            {{ user ? 'Guarda tu horario en la nube para acceder desde cualquier dispositivo.' : 'Si no has iniciado sesión, al guardar se abrirá el registro.' }}
          </span>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="helpDialog = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbarGuardado" timeout="2000" location="bottom">
    {{ snackbarGuardadoMsg }}
  </v-snackbar>

  <v-snackbar v-model="mostrarMensajeExportacion" timeout="2200" location="bottom">
    estoy trabajando en ello
  </v-snackbar>
</template>

<style scoped>
.dialog-header {
  background: #4285f4;
}

.dialog-text {
  font-size: 0.875rem;
  line-height: 1.5;
}

.dialog-section-title {
  color: #1565c0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dialog-list {
  margin: 0;
  padding-left: 20px;
}
.dialog-list li {
  margin-bottom: 6px;
}
.dialog-list li:last-child {
  margin-bottom: 0;
}

.dialog-action-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.dialog-action-row span {
  padding-top: 4px;
}
.dialog-action-row--last {
  margin-bottom: 0;
}

.topbar-unificada {
  background: #4285f4;
  color: #ffffff;
}

.topbar-unificada :deep(.v-toolbar-title__placeholder) {
  color: #ffffff;
  font-weight: 600;
}

.topbar-unificada__icon {
  color: #ffffff !important;
}

/* Guía "Semestre → Materia → Grupo": mismos colores que usan los ítems
   activos de la lista, para que un estudiante nuevo entienda de un
   vistazo qué va tocando en cada paso. */
.materias-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 0.7rem;
  color: rgba(0, 0, 0, 0.6);
}
.materias-hint__nivel {
  color: #4285f4;
  font-weight: 700;
}
.materias-hint__materia {
  color: #fb8c00;
  font-weight: 700;
}
.materias-hint__arrow {
  opacity: 0.5;
}

/* Panel "Añadir materias" (desktop y mobile): un solo tamaño de letra por
   nivel jerárquico (semestre / materia / grupo), consistente entre las dos
   vistas. En mobile además se comprimen las filas para que entren más
   ítems sin tanto scroll. */
.materias-panel :deep(.v-list-item-title) {
  font-size: 0.85rem;
  line-height: 1.3;
}
.materias-panel :deep(.v-list-item-subtitle) {
  font-size: 0.72rem;
}
.materias-panel :deep(.v-label) {
  font-size: 0.85rem;
  opacity: 1;
}

.materias-mobile-panel :deep(.v-list-item) {
  min-height: 34px;
}
.materias-mobile-panel :deep(.v-list-item-title) {
  font-size: 0.8rem;
  line-height: 1.25;
}
.materias-mobile-panel :deep(.v-list-item-subtitle) {
  font-size: 0.68rem;
}
.materias-mobile-panel :deep(.v-selection-control) {
  min-height: 32px;
}
.materias-mobile-panel :deep(.v-selection-control__wrapper) {
  transform: scale(0.85);
}
.materias-mobile-panel :deep(.v-label) {
  font-size: 0.8rem;
  opacity: 1;
}

.toggle-materias {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: normal;
}
</style>
