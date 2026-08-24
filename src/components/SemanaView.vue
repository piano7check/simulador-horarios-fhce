<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { mdiAlertCircleOutline, mdiFormatListBulleted } from '@mdi/js'
import type { Clase } from '@/services/horarios'
import { descargarHorario, descargarHorarioImagen, imprimirHorario } from '@/utils/exportarHorario'

/* -- Tipos -- */

interface CursoSeleccionado {
  key: string
  materiaNombre: string
  materiaCodigo: string
  grupoNumero: string
  clases: Clase[]
}

const props = defineProps<{
  cursos: CursoSeleccionado[]
  nombreCarrera?: string
  nombreNivel?: string
  gestion?: string
  estudianteNombre?: string
}>()

/* -- Responsive -- */
const { mobile } = useDisplay()
const intervalHeight = computed(() => (mobile.value ? 42 : 50))
// La etiqueta de hora es corta ("6:45", "14:15"), así que en mobile no hace
// falta el ancho por defecto de Vuetify (60px) — angostarla deja más
// espacio visible para las columnas de los días, que es lo que el
// estudiante realmente necesita ver al scrollear.
const intervalWidth = computed(() => (mobile.value ? 42 : 60))

/* -- Calendario semanal (mobile): se hace scrolleable horizontalmente con
   columnas más anchas; al entrar se posiciona en el día actual -- */
function diaActualODefault(): string {
  const map: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miercoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sabado',
  }
  return map[new Date().getDay()] ?? 'Lunes'
}

const calendarWrapperRef = ref<HTMLElement | null>(null)

/* -- Detalle de evento: la celda del calendario es angosta y puede truncar
   materia/docente/aula, así que al tocar/click un evento se muestra todo
   el texto completo en un diálogo -- */
const DIA_LABEL: Record<string, string> = {
  Lunes: 'Lunes',
  Martes: 'Martes',
  Miercoles: 'Miércoles',
  Jueves: 'Jueves',
  Viernes: 'Viernes',
  Sabado: 'Sábado',
}

const eventoDetalle = ref<EventoCal | null>(null)
const leyendaDialog = ref(false)

function abrirDetalle(ev: EventoCal) {
  eventoDetalle.value = ev
}

const detalleHorario = computed(() => {
  const ev = eventoDetalle.value
  if (!ev) return ''
  return `${ev.start.slice(11)} - ${ev.end.slice(11)}`
})

/** Nombra la plataforma según el dominio del link, para que el estudiante
 * sepa de un vistazo si es Classroom, Moodle, etc. sin tener que abrirlo. */
function etiquetaAulaVirtual(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('classroom.google.com')) return 'Classroom'
  if (u.includes('moodle')) return 'Moodle'
  if (u.includes('meet.google.com')) return 'Google Meet'
  if (u.includes('zoom.us')) return 'Zoom'
  if (u.includes('teams.microsoft.com')) return 'Microsoft Teams'
  return 'Aula virtual'
}

function scrollToDia(dia: string, smooth: boolean) {
  const wrapper = calendarWrapperRef.value
  if (!wrapper) return
  const idx = DIA_OFFSET[dia] ?? 0
  const el = wrapper.querySelectorAll('.v-calendar-daily__day')[idx] as HTMLElement | undefined
  el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'start', block: 'nearest' })
}

onMounted(() => {
  if (mobile.value) nextTick(() => scrollToDia(diaActualODefault(), false))
})

/* -- Rango dinámico: solo intervalos con eventos -- */
const INTERVALO_MIN = 90 // minutos
const BASE_INICIO = 6 * 60 + 45 // 6:45 en minutos

const rangoVisible = computed(() => {
  if (eventosBase.value.length === 0) {
    return { firstTime: { hour: 6, minute: 45 }, intervalCount: 10 }
  }

  let minT = Infinity
  let maxT = -Infinity
  for (const e of eventosBase.value) {
    const s = timeMin(e.start.slice(11))
    const end = timeMin(e.end.slice(11))
    if (s < minT) minT = s
    if (end > maxT) maxT = end
  }

  // Alinear al slot de 90 min más cercano por debajo del inicio
  let slotInicio = BASE_INICIO
  while (slotInicio + INTERVALO_MIN <= minT) slotInicio += INTERVALO_MIN
  // Al menos un slot antes si hay espacio
  if (slotInicio > BASE_INICIO) slotInicio -= INTERVALO_MIN

  // Cantidad de intervalos necesarios para cubrir hasta maxT + margen
  const totalMin = maxT - slotInicio + INTERVALO_MIN // +1 slot de margen
  const count = Math.max(2, Math.ceil(totalMin / INTERVALO_MIN))

  return {
    firstTime: { hour: Math.floor(slotInicio / 60), minute: slotInicio % 60 },
    intervalCount: count,
  }
})

/* -- Mapeo de días a offsets desde Lunes -- */
const DIA_OFFSET: Record<string, number> = {
  Lunes: 0,
  Martes: 1,
  Miercoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sabado: 5,
}

function getLunesRef(): Date {
  const hoy = new Date()
  const dow = hoy.getDay() // 0 = Dom
  const diff = dow === 0 ? -6 : 1 - dow
  const d = new Date(hoy)
  d.setDate(hoy.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function fechaParaDia(dia: string): string {
  const lunes = getLunesRef()
  lunes.setDate(lunes.getDate() + (DIA_OFFSET[dia] ?? 0))
  return fmtDate(lunes)
}

const calendarValue = computed(() => fmtDate(getLunesRef()))

/* -- Formateo del header: solo nombre de día, sin fecha -- */
const NOMBRES_DIA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}
const NOMBRES_DIA_CORTO: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
}
function weekdayFormat(ts: { weekday: number }, short: boolean) {
  return short ? (NOMBRES_DIA_CORTO[ts.weekday] ?? '') : (NOMBRES_DIA[ts.weekday] ?? '')
}
function dayFormat() {
  return ''
}

/* -- Paleta de 20 colores distinguibles -- */
const COLORES = [
  '#1976D2', // azul
  '#388E3C', // verde
  '#F57C00', // naranja
  '#7B1FA2', // morado
  '#00897B', // teal
  '#5D4037', // café
  '#C2185B', // rosa
  '#0277BD', // celeste
  '#EF6C00', // naranja fuerte
  '#283593', // índigo
  '#00ACC1', // cyan
  '#8E24AA', // púrpura
  '#43A047', // verde medio
  '#D81B60', // magenta
  '#3949AB', // azul índigo
  '#6D4C41', // marrón
  '#039BE5', // azul claro
  '#E65100', // naranja oscuro
  '#1B5E20', // verde oscuro
  '#AD1457', // rosa oscuro
]

/** Un color por cada grupo seleccionado (grupoKey = "materiaId-grupoNumero") */
const coloresGrupos = computed(() => {
  const map = new Map<string, string>()
  let idx = 0
  for (const c of props.cursos) {
    if (!map.has(c.key)) {
      map.set(c.key, COLORES[idx % COLORES.length]!)
      idx++
    }
  }
  return map
})

/* -- Eventos base -- */
interface EventoCal {
  name: string
  start: string
  end: string
  color: string
  timed: boolean
  materiaCodigo: string
  materiaNombre: string
  grupoKey: string
  grupoNumero: number
  dia: string
  aula: string
  docente: string
  aulaVirtual: string | null
  whatsappGrupo: string | null
  conflicto: boolean
}

const eventosBase = computed<EventoCal[]>(() => {
  const out: EventoCal[] = []
  const seen = new Set<string>()
  for (const curso of props.cursos) {
    const color = coloresGrupos.value.get(curso.key) ?? COLORES[0]!
    for (const c of curso.clases) {
      // dedupe by curso key + dia + horarios
      const startShort = c.hora_inicio.slice(0, 5)
      const endShort = c.hora_fin.slice(0, 5)
      const id = `${curso.key}|${c.dia}|${startShort}|${endShort}`
      if (seen.has(id)) continue
      seen.add(id)

      const fecha = fechaParaDia(c.dia)
      out.push({
        name: curso.materiaNombre,
        start: `${fecha} ${startShort}`,
        end: `${fecha} ${endShort}`,
        color,
        timed: true,
        materiaCodigo: curso.materiaCodigo,
        materiaNombre: curso.materiaNombre,
        grupoKey: curso.key,
        grupoNumero: Number(curso.grupoNumero),
        dia: c.dia,
        aula: c.aula,
        docente: c.docente,
        aulaVirtual: c.aula_virtual,
        whatsappGrupo: c.whatsapp_grupo,
        conflicto: false,
      })
    }
  }
  return out
})

/* -- Detección de choques -- */
function timeMin(t: string) {
  const parts = t.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

/** Claves "grupoKey|dia" de todos los eventos que chocan con otro */
const conflictos = computed(() => {
  const keys = new Set<string>()
  const evts = eventosBase.value

  for (let i = 0; i < evts.length; i++) {
    for (let j = i + 1; j < evts.length; j++) {
      const a = evts[i]!
      const b = evts[j]!
      if (a.grupoKey === b.grupoKey || a.dia !== b.dia) continue

      const aS = timeMin(a.start.slice(11))
      const aE = timeMin(a.end.slice(11))
      const bS = timeMin(b.start.slice(11))
      const bE = timeMin(b.end.slice(11))

      if (aS < bE && bS < aE) {
        keys.add(`${a.grupoKey}|${a.dia}`)
        keys.add(`${b.grupoKey}|${b.dia}`)
      }
    }
  }
  return { keys }
})

/** Eventos finales: cada uno marca si está en choque, sin perder su color */
const eventos = computed(() =>
  eventosBase.value.map((e) => ({
    ...e,
    conflicto: conflictos.value.keys.has(`${e.grupoKey}|${e.dia}`),
  })),
)

/* -- Leyenda de colores -- */
const leyenda = computed(() =>
  props.cursos.map((c) => {
    const color = coloresGrupos.value.get(c.key) ?? COLORES[0]!
    const docente = c.clases[0]?.docente ?? ''
    return {
      key: c.key,
      color,
      texto: `G ${c.grupoNumero}: ${c.materiaNombre} - ${docente}`,
    }
  }),
)

/* -- Exportar: imprimir / descargar -- */
const capturaRef = ref<HTMLElement | null>(null)
const exportando = ref(false)

function buildTitulo() {
  return `Horario ${props.nombreCarrera ?? ''}`
}

const gestionTexto = computed(() => props.gestion?.trim() || '')
const estudianteTexto = computed(() => props.estudianteNombre?.trim() || '')

async function descargarPDF() {
  if (!capturaRef.value) return
  exportando.value = true
  try {
    await descargarHorario({
      elemento: capturaRef.value,
      titulo: buildTitulo(),
      gestion: props.gestion,
      estudiante: props.estudianteNombre,
    })
  } finally {
    exportando.value = false
  }
}

async function descargarImagen() {
  if (!capturaRef.value) return
  exportando.value = true
  try {
    await descargarHorarioImagen({
      elemento: capturaRef.value,
      titulo: buildTitulo(),
      gestion: props.gestion,
      estudiante: props.estudianteNombre,
    })
  } finally {
    exportando.value = false
  }
}

async function imprimir() {
  if (!capturaRef.value) return
  exportando.value = true
  try {
    await imprimirHorario({
      elemento: capturaRef.value,
      titulo: buildTitulo(),
      gestion: props.gestion,
      estudiante: props.estudianteNombre,
    })
  } finally {
    exportando.value = false
  }
}

defineExpose({ descargarPDF, descargarImagen, imprimir })
</script>

<template>
  <div style="position: relative">
    <!-- Overlay de carga al exportar -->
    <v-overlay :model-value="exportando" contained persistent class="align-center justify-center">
      <div class="d-flex flex-column align-center">
        <v-progress-circular indeterminate size="48" color="primary" />
        <p class="text-body-1 mt-3">Generando documento…</p>
      </div>
    </v-overlay>

    <!-- Detalle completo de una clase (por si el nombre/docente/aula se
         truncan en la celda angosta del calendario) -->
    <v-dialog
      :model-value="eventoDetalle !== null"
      max-width="360"
      @update:model-value="
        (v: boolean) => {
          if (!v) eventoDetalle = null
        }
      "
    >
      <v-card v-if="eventoDetalle" rounded="lg">
        <v-card-item :style="{ background: eventoDetalle.color }">
          <v-card-title class="text-white text-wrap">
            G{{ eventoDetalle.grupoNumero }}: {{ eventoDetalle.materiaNombre }}
          </v-card-title>
        </v-card-item>
        <v-card-text class="pt-4">
          <p class="mb-2">
            <strong>Docente:</strong> {{ eventoDetalle.docente || 'No especificado' }}
          </p>
          <p class="mb-2"><strong>Aula:</strong> {{ eventoDetalle.aula || 'No especificada' }}</p>
          <p :class="eventoDetalle.aulaVirtual || eventoDetalle.whatsappGrupo ? 'mb-2' : 'mb-0'">
            <strong>Horario:</strong> {{ DIA_LABEL[eventoDetalle.dia] ?? eventoDetalle.dia }},
            {{ detalleHorario }}
          </p>
          <p v-if="eventoDetalle.aulaVirtual" class="mb-2">
            <strong>{{ etiquetaAulaVirtual(eventoDetalle.aulaVirtual) }}:</strong>
            <a :href="eventoDetalle.aulaVirtual" target="_blank" rel="noopener">Abrir enlace</a>
          </p>
          <p v-if="eventoDetalle.whatsappGrupo" class="mb-0">
            <strong>Grupo de WhatsApp:</strong>
            <a :href="eventoDetalle.whatsappGrupo" target="_blank" rel="noopener">Unirme</a>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="eventoDetalle = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Zona capturable para PDF/impresión -->
    <div ref="capturaRef" style="background: #fff">
      <!-- En mobile el nombre de la carrera ya se ve en el header de arriba,
           así que este bloque se reduce a lo mínimo para dejar más espacio
           al horario. Se mantiene completo para la exportación (impresión/PDF). -->
      <div class="horario-header" :class="mobile ? 'mb-2 horario-header--compact' : 'mb-3'">
        <p class="horario-header__title">{{ buildTitulo() }}</p>
        <p v-if="mobile" class="horario-header__meta">
          <template v-if="gestionTexto"><strong>Gestión:</strong> {{ gestionTexto }}</template>
          <template v-if="gestionTexto && estudianteTexto"> · </template>
          <template v-if="estudianteTexto"><strong>Nombre:</strong> {{ estudianteTexto }}</template>
        </p>
        <template v-else>
          <p v-if="gestionTexto" class="horario-header__meta">
            <strong>Gestión:</strong> {{ gestionTexto }}
          </p>
          <p v-if="estudianteTexto" class="horario-header__meta">
            <strong>Nombre:</strong> {{ estudianteTexto }}
          </p>
        </template>
      </div>

      <div ref="calendarWrapperRef" class="calendar-scroll-wrapper">
        <v-calendar
          :model-value="calendarValue"
          type="week"
          :weekdays="[1, 2, 3, 4, 5, 6]"
          :first-day-of-week="1"
          :events="eventos"
          event-overlap-mode="column"
          :event-overlap-threshold="30"
          :first-time="rangoVisible.firstTime"
          :interval-minutes="90"
          :interval-count="rangoVisible.intervalCount"
          :interval-height="intervalHeight"
          :interval-width="intervalWidth"
          :show-interval-label="() => true"
          :weekday-format="weekdayFormat"
          :day-format="dayFormat"
          now="2000-01-01 00:00:00"
          locale="es"
          :style="mobile ? { minWidth: '880px' } : undefined"
        >
          <!-- Contenido custom de cada evento -->
          <template #event="{ event: ev }">
            <div
              class="semana-ev px-1"
              :class="{ 'semana-ev--conflicto': ev.conflicto }"
              @click="abrirDetalle(ev as unknown as EventoCal)"
            >
              <div class="semana-ev__name font-weight-bold">
                <v-icon v-if="ev.conflicto" :icon="mdiAlertCircleOutline" size="11" class="mr-1" />
                G{{ ev.grupoNumero }}: {{ ev.materiaNombre }}
              </div>
              <!-- El aula va antes que el docente: si la celda es muy baja y
                   algo se recorta, que sea el docente y no el aula -->
              <div class="semana-ev__detail semana-ev__detail--aula">{{ ev.aula }}</div>
              <div class="semana-ev__detail text-truncate">{{ ev.docente }}</div>
            </div>
          </template>
        </v-calendar>
      </div>
    </div>
    <!-- /capturaRef -->

    <!-- Resumen de materias tomadas: en modal para no ocupar espacio
         vertical bajo el horario (no afecta la exportación/impresión, que
         arma su propio resumen a partir de la grilla). -->
    <div v-if="leyenda.length" class="mt-3 px-1">
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        :prepend-icon="mdiFormatListBulleted"
        @click="leyendaDialog = true"
      >
        Materias tomadas ({{ leyenda.length }})
      </v-btn>
    </div>

    <v-dialog v-model="leyendaDialog" max-width="480">
      <v-card rounded="lg">
        <v-card-title>Materias tomadas</v-card-title>
        <v-card-text class="pt-0">
          <div class="d-flex flex-wrap ga-3">
            <div v-for="item in leyenda" :key="item.key" class="d-flex align-center ga-1">
              <span class="semana-dot" :style="{ background: item.color }" />
              <span class="text-caption">{{ item.texto }}</span>
            </div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="leyendaDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.calendar-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
:deep(.v-calendar-daily_head-day-label) {
  display: none !important;
}
/* Vuetify NO fija la columna de horas por su cuenta: hay que hacerlo a
   mano para que, al scrollear horizontalmente en mobile (la grilla mide
   880px de ancho mínimo), el estudiante siga viendo a qué hora
   corresponde cada materia sin importar qué día esté mirando. Se pinta
   igual que la fila de los días (mismo azul, texto blanco) para que se
   lea como parte del mismo encabezado, con más z-index para que los
   eventos de los días no se vean "pasar por debajo" del texto al quedar
   fija por encima. */
:deep(.v-calendar-daily__intervals-head),
:deep(.v-calendar-daily__intervals-body) {
  position: sticky;
  left: 0;
  background-color: #1565c0;
  border-right-color: #e0e0e0 !important;
  z-index: 3;
}
:deep(.v-calendar-daily__interval-text) {
  color: #fff !important;
}
/* El color de línea de Vuetify (rgba(0,0,0,0.12)) se ve gris claro sobre
   blanco, pero sobre el fondo azul de esta columna se ve como una franja
   oscura (el negro semitransparente oscurece el azul en vez de aclararlo).
   Se usa el mismo gris ya "resuelto" (#e0e0e0, equivalente a como se ve
   sobre blanco) en vez de la versión semitransparente, para que la línea
   se vea igual en toda la tabla sin importar el fondo detrás. */
:deep(.v-calendar-daily__intervals-body) {
  border-bottom: #e0e0e0 1px solid;
}
/* Vuetify centra la etiqueta de cada hora sobre la línea divisoria con
   "top: -6px", superponiéndola con el intervalo anterior (por eso la
   línea de la tabla parece "cortar" el texto). Se deja cada etiqueta
   dentro de su propio intervalo, sin cruzar la línea. */
:deep(.v-calendar-daily__interval-text) {
  top: 0;
}
/* La columna de horas solo traía una marquita de 8px junto al borde
   derecho; se le agrega la misma línea completa que ya tienen las
   columnas de los días, para que la grilla se vea continua fila a fila. */
:deep(.v-calendar-daily__interval) {
  border-top: #e0e0e0 1px solid;
}
:deep(.v-calendar-daily__interval:first-child) {
  border-top: none;
}
/* La línea que separa el encabezado (días) de la primera hora (6:45) usa
   por defecto un degradado que se desvanece hacia la izquierda, sobre la
   columna de horas, dejándola "cortada". Se reemplaza por una línea
   sólida, del mismo color que el resto de líneas de la grilla. */
:deep(.v-calendar-daily__intervals-head::after) {
  background: #e0e0e0 !important;
}
/* Vuetify envuelve el calendario en varios contenedores internos con
   "overflow: hidden" propio (el div raíz .v-calendar-daily, .v-calendar-daily__body,
   .v-calendar-daily__scroll-area y .v-calendar-daily__pane). Cualquiera de
   esos overflow "no visible" que quede ANTES de llegar a
   .calendar-scroll-wrapper hace que la columna de horas quede "sticky"
   respecto a ESE contenedor interno en vez del nuestro — y como ese
   contenedor interno nunca scrollea (el que scrollea es nuestro wrapper),
   la columna termina moviéndose junto con todo lo demás en vez de quedar
   fija. Se anulan todos esos overflow para que el único contenedor con
   scroll real en la cadena sea el wrapper que controlamos, y así left:0
   se calcule contra ese. */
:deep(.v-calendar-daily),
:deep(.v-calendar-daily__body),
:deep(.v-calendar-daily__scroll-area),
:deep(.v-calendar-daily__pane) {
  overflow: visible !important;
}
:deep(.v-calendar-weekly__head-weekday),
:deep(.v-calendar-daily_head-weekday) {
  background-color: #1565c0;
  color: #fff !important;
  font-weight: 600;
  padding: 4px 0;
}
.semana-ev {
  overflow: hidden;
  line-height: 1.3;
  cursor: pointer;
}
.semana-ev--conflicto {
  box-shadow:
    inset 0 0 0 2px #ffffff,
    inset 0 0 0 4px #d32f2f;
}
.semana-ev__name {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.semana-ev__detail {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.semana-ev__detail--aula {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 700;
  color: #fff;
}

.horario-header {
  border: 1px solid #d6e4ff;
  border-radius: 10px;
  padding: 10px 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
}

.horario-header__title {
  margin: 0;
  color: #0d47a1;
  font-size: 1rem;
  font-weight: 700;
}

.horario-header__meta {
  margin: 3px 0 0;
  color: #2b3f63;
  font-size: 0.86rem;
}

.horario-header--compact {
  padding: 5px 10px;
}
.horario-header--compact .horario-header__title {
  font-size: 0.82rem;
}
.horario-header--compact .horario-header__meta {
  font-size: 0.7rem;
  margin-top: 1px;
}

.semana-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}
</style>
