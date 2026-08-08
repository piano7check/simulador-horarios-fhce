<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'
import { obtenerMaterias, obtenerClases, type Materia, type Clase } from '@/services/horarios'
import {
  mdiChevronLeft,
  mdiBookOpenVariant,
  mdiChevronDown,
  mdiPlus,
  mdiDeleteSweep,
  mdiPrinter,
  mdiDownload,
  mdiDotsVertical,
  mdiClose,
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

// Mobile: FAB menú acciones
const fabAbierto = ref(false)
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
  fabAbierto.value = false
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

async function guardar() {
  if (!user.value) {
    helpDialog.value = false
    authDialog.value = true
    return
  }
  guardando.value = true
  try {
    await guardarHorario(user.value.id, carreraId, [...gruposSeleccionados.value])
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
  if (newUser && materias.value.length > 0) await evaluarHorarioGuardadoEnLogin()
})

// Ref al componente SemanaView para llamar sus métodos expuestos
const semanaRef = ref<InstanceType<typeof SemanaView> | null>(null)
const semanaRefMobile = ref<InstanceType<typeof SemanaView> | null>(null)
const semanaExportar = computed(() => (mobile.value ? semanaRefMobile.value : semanaRef.value))

// Nombre legible de la carrera
const nombreCarrera = computed(() => carrera.replace(/-/g, ' '))

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

function descargar() {
  fabAbierto.value = false
  const target = semanaExportar.value
  if (!target?.descargar) {
    mostrarMensajeExportacion.value = true
    return
  }
  target.descargar()
}

function imprimir() {
  fabAbierto.value = false
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
    await cargarHorarioGuardado()
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
    <v-card>
      <v-card-title class="text-h6">Encontramos un horario guardado</v-card-title>
      <v-card-text>
        Ya tienes un horario guardado para esta carrera. ¿Qué deseas hacer?
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="mantenerHorarioActual">Mantener horario actual</v-btn>
        <v-btn color="primary" variant="flat" @click="usarHorarioGuardado">Mostrar horario guardado</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ════════ DESKTOP ════════ -->
  <v-layout class="d-none d-md-flex" style="height: 100%">
    <!-- Sidebar izquierdo -->
    <v-navigation-drawer permanent width="320">
      <v-list-item>
        <template #prepend>
          <v-btn :icon="mdiChevronLeft" variant="text" size="small" to="/" />
        </template>
        <v-list-item-title class="text-subtitle-1 font-weight-bold">
          {{ carrera.replace(/-/g, ' ') }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ GESTION }}</v-list-item-subtitle>
      </v-list-item>

      <v-divider />

      <div v-if="cargando" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate size="32" />
      </div>

      <v-alert v-else-if="errorMsg" type="error" variant="tonal" class="ma-2">
        {{ errorMsg }}
      </v-alert>

      <v-list v-else density="compact" nav>
        <template v-for="nivel in niveles" :key="nivel.codigo">
          <!-- Nivel -->
          <v-list-item
            :active="nivelActivo === nivel.codigo"
            color="primary"
            @click="seleccionarNivel(nivel.codigo)"
          >
            <v-list-item-title class="font-weight-medium">
              Semestre {{ nivel.nombre }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ nivel.codigo }}</v-list-item-subtitle>
          </v-list-item>

          <!-- Materias del nivel -->
          <v-expand-transition>
            <div v-if="nivelActivo === nivel.codigo">
              <template v-for="materia in nivel.materias" :key="materia.id">
                <!-- Materia (click expande grupos) -->
                <v-list-item
                  :active="materiasExpandidas.has(materia.id)"
                  color="secondary"
                  class="pl-8"
                  @click="toggleMateria(materia)"
                >
                  <template #prepend>
                    <v-icon :icon="mdiBookOpenVariant" size="x-small" />
                  </template>
                  <v-list-item-title class="text-body-2">
                    {{ materia.nombre }}
                  </v-list-item-title>
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
              :href="`https://wa.me/59177914381?text=${encodeURIComponent('Tengo un problema con tu app, si me ayudas te invito un café.')}`"
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
          <v-btn icon variant="outlined" size="small" @click="descargar" title="Descargar">
            <v-icon :icon="mdiDownload" />
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
              :href="`https://wa.me/59177914381?text=${encodeURIComponent('Tengo un problema con la carrera ' + carrera + ' Y YA CONSULTE SI HAY HORARIOS PUBLICOS PARA MI CARRERA')}`"
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
              Selecciona grupos desde el panel izquierdo
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
    <!-- Parte superior: cursos seleccionados -->
    <div class="flex-grow-1 overflow-y-auto" style="min-height: 0">
      <!-- Header mobile -->
      <v-toolbar density="compact" flat class="topbar-unificada" color="#4285f4" theme="dark">
        <v-btn :icon="mdiChevronLeft" variant="text" size="small" to="/" class="topbar-unificada__icon" />
        <v-toolbar-title class="text-subtitle-2">
          {{ carrera.replace(/-/g, ' ') }}
        </v-toolbar-title>
      </v-toolbar>

      <v-container>
        <!-- Sin grupos seleccionados -->
        <div
          v-if="cursosSeleccionados.length === 0"
          class="d-flex flex-column align-center justify-center"
          style="min-height: 40vh"
        >
          <template v-if="materias.length === 0 && !cargando && !errorMsg">
            <v-icon size="48" color="grey-lighten-1">mdi-emoticon-sad-outline</v-icon>
            <p class="text-body-1 text-medium-emphasis mt-3 text-center">
              Parece que no encontramos los horarios de esta carrera
            </p>
            <a
              :href="`https://wa.me/59177914381?text=${encodeURIComponent('Tengo un problema con la carrera ' + carrera + ' Y YA CONSULTE SI HAY HORARIOS PUBLICOS PARA MI CARRERA')}`"
              target="_blank"
              rel="noopener"
              style="text-decoration: none; margin-top: 12px"
            >
              <v-btn color="primary" variant="tonal" size="small"> Reportar este error </v-btn>
            </a>
          </template>
          <template v-else>
            <v-icon :icon="mdiBookOpenVariant" size="48" color="grey-lighten-1" />
            <p class="text-body-1 text-medium-emphasis mt-3 text-center">
              Selecciona grupos para comenzar
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

    <!-- FAB flotante + opciones móvil -->
    <div class="flex-shrink-0 position-relative">
      <!-- FAB flotante (encima del panel de opciones) -->
      <v-btn
        v-if="cursosSeleccionados.length > 0"
        icon
        size="small"
        :color="fabAbierto ? 'error' : 'primary'"
        class="fab-acciones"
        elevation="4"
        @click="fabAbierto = !fabAbierto"
      >
        <v-icon :icon="fabAbierto ? mdiClose : mdiDotsVertical" />
      </v-btn>

      <v-expand-transition>
        <div v-show="fabAbierto && cursosSeleccionados.length > 0" class="border-t bg-surface">
          <v-list density="compact" nav class="py-1">
            <v-list-item @click="quitarTodo">
              <v-list-item-title class="text-body-2">Quitar todo</v-list-item-title>
              <template #append>
                <v-avatar size="32" color="error" variant="tonal">
                  <v-icon :icon="mdiDeleteSweep" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-list-item @click="imprimir">
              <v-list-item-title class="text-body-2">Imprimir</v-list-item-title>
              <template #append>
                <v-avatar size="32" color="primary" variant="tonal">
                  <v-icon :icon="mdiPrinter" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-list-item @click="descargar">
              <v-list-item-title class="text-body-2">Descargar</v-list-item-title>
              <template #append>
                <v-avatar size="32" color="primary" variant="tonal">
                  <v-icon :icon="mdiDownload" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-list-item @click="guardar">
              <v-list-item-title class="text-body-2">Guardar horario</v-list-item-title>
              <template #append>
                <v-avatar size="32" color="success" variant="tonal">
                  <v-icon :icon="mdiContentSave" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
            <v-list-item @click="helpDialog = true">
              <v-list-item-title class="text-body-2">Ayuda</v-list-item-title>
              <template #append>
                <v-avatar size="32" color="primary" variant="tonal">
                  <v-icon :icon="mdiHelpCircle" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-expand-transition>

      <!-- Última actualización y link para reportar (mobile) -->
      <div class="px-4 pb-2">
        <div class="text-caption text-medium-emphasis">
          Actualizado por última vez el: {{ formatScraped(lastScraped) }}
        </div>
        <div class="text-caption mt-1">
          <a
            :href="`https://wa.me/59177914381?text=${encodeURIComponent('Tengo un problema con tu app, si me ayudas te invito un café.')}`"
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
      <v-btn block variant="tonal" rounded="0" @click="panelMobileAbierto = !panelMobileAbierto">
        <v-icon :icon="panelMobileAbierto ? mdiChevronDown : mdiPlus" class="mr-2" />
        {{ panelMobileAbierto ? 'Ocultar materias' : 'Añadir materias' }}
      </v-btn>
    </div>

    <!-- Parte inferior: navegación de materias -->
    <v-expand-transition>
      <div
        v-show="panelMobileAbierto"
        class="flex-shrink-0 overflow-y-auto border-t"
        style="max-height: 45vh"
      >
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
              @click="seleccionarNivel(nivel.codigo)"
            >
              <v-list-item-title class="font-weight-medium text-body-2">
                {{ nivel.nombre }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ nivel.codigo }}</v-list-item-subtitle>
            </v-list-item>

            <v-expand-transition>
              <div v-if="nivelActivo === nivel.codigo">
                <template v-for="materia in nivel.materias" :key="materia.id">
                  <v-list-item
                    :active="materiasExpandidas.has(materia.id)"
                    color="secondary"
                    class="pl-8"
                    @click="toggleMateria(materia)"
                  >
                    <template #prepend>
                      <v-icon :icon="mdiBookOpenVariant" size="x-small" />
                    </template>
                    <v-list-item-title class="text-caption">
                      {{ materia.nombre }}
                    </v-list-item-title>
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
    <v-card>
      <v-card-title class="text-h6">Ayuda rápida</v-card-title>
      <v-card-text>
        <p class="text-subtitle-2 mb-1">Armar tu horario</p>
        <ol class="mb-4">
          <li>Escoge el semestre con las materias que quieres cursar.</li>
          <li>Selecciona el grupo de cada materia para verlo en el horario.</li>
          <li>¿Tienes un choque? Prueba con otro grupo de alguna materia involucrada.</li>
          <li>Si el choque persiste, quizás debas elegir a qué materia asistir este semestre.</li>
        </ol>

        <v-divider class="mb-3" />

        <p class="text-subtitle-2 mb-2">Guardar y exportar</p>
        <div class="d-flex align-center ga-3 mb-2">
          <v-btn icon variant="outlined" size="small" @click="imprimir">
            <v-icon :icon="mdiPrinter" />
          </v-btn>
          <span class="text-body-2">Imprime el horario directamente.</span>
        </div>
        <div class="d-flex align-center ga-3 mb-2">
          <v-btn icon variant="outlined" size="small" @click="descargar">
            <v-icon :icon="mdiDownload" />
          </v-btn>
          <span class="text-body-2">Descarga el horario como imagen.</span>
        </div>
        <div class="d-flex align-center ga-3">
          <v-btn icon variant="outlined" size="small" color="success" @click="guardar">
            <v-icon :icon="mdiContentSave" />
          </v-btn>
          <span class="text-body-2">
            {{ user ? 'Guarda tu horario en la nube para acceder desde cualquier dispositivo.' : 'Si no has iniciado sesión, al guardar se abrirá el registro.' }}
          </span>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="helpDialog = false">Cerrar</v-btn>
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

.fab-acciones {
  position: absolute;
  top: -44px;
  right: 12px;
  z-index: 5;
}
</style>
