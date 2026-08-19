<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { mdiAlertCircleOutline, mdiMapMarker } from '@mdi/js'
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

/* -- Navegación por día (mobile): el calendario semanal se hace scrolleable
   horizontalmente con columnas más anchas; las pestañas saltan a cada día -- */
const DIAS_TABS = [
  { key: 'Lunes', corto: 'Lun' },
  { key: 'Martes', corto: 'Mar' },
  { key: 'Miercoles', corto: 'Mié' },
  { key: 'Jueves', corto: 'Jue' },
  { key: 'Viernes', corto: 'Vie' },
  { key: 'Sabado', corto: 'Sáb' },
] as const

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

const diaActivoMobile = ref(diaActualODefault())
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

function abrirDetalle(ev: EventoCal) {
  eventoDetalle.value = ev
}

const detalleHorario = computed(() => {
  const ev = eventoDetalle.value
  if (!ev) return ''
  return `${ev.start.slice(11)} - ${ev.end.slice(11)}`
})

function scrollToDia(dia: string, smooth: boolean) {
  const wrapper = calendarWrapperRef.value
  if (!wrapper) return
  const idx = DIA_OFFSET[dia] ?? 0
  const el = wrapper.querySelectorAll('.v-calendar-daily__day')[idx] as HTMLElement | undefined
  el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', inline: 'start', block: 'nearest' })
}

function irADia(dia: string) {
  diaActivoMobile.value = dia
  nextTick(() => scrollToDia(dia, true))
}

onMounted(() => {
  if (mobile.value) nextTick(() => scrollToDia(diaActivoMobile.value, false))
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

interface Conflicto {
  materia1: string
  grupo1: number
  materia2: string
  grupo2: number
  dia: string
}

const conflictos = computed(() => {
  const lista: Conflicto[] = []
  const keys = new Set<string>()
  const seen = new Set<string>()
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
        const id = [a.grupoKey, b.grupoKey].sort().join('|') + '|' + a.dia
        if (!seen.has(id)) {
          seen.add(id)
          lista.push({
            materia1: a.materiaNombre,
            grupo1: a.grupoNumero,
            materia2: b.materiaNombre,
            grupo2: b.grupoNumero,
            dia: a.dia,
          })
        }
        keys.add(`${a.grupoKey}|${a.dia}`)
        keys.add(`${b.grupoKey}|${b.dia}`)
      }
    }
  }
  return { lista, keys }
})

/** Días (mobile) que tienen algún choque, para marcar la pestaña */
const diasConConflicto = computed(() => {
  const set = new Set<string>()
  for (const key of conflictos.value.keys) {
    const dia = key.split('|')[1]
    if (dia) set.add(dia)
  }
  return set
})

/** Eventos finales: solapamientos forzados a rojo */
const eventos = computed(() =>
  eventosBase.value.map((e) => ({
    ...e,
    color: conflictos.value.keys.has(`${e.grupoKey}|${e.dia}`) ? '#D32F2F' : e.color,
  })),
)

/** Eventos del día activo (mobile), ordenados por hora, para la agenda */
const eventosDelDiaActivo = computed(() =>
  eventos.value
    .filter((e) => e.dia === diaActivoMobile.value)
    .sort((a, b) => a.start.localeCompare(b.start)),
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
      @update:model-value="(v: boolean) => { if (!v) eventoDetalle = null }"
    >
      <v-card v-if="eventoDetalle" rounded="lg">
        <v-card-item :style="{ background: eventoDetalle.color }">
          <v-card-title class="text-white text-wrap">
            G{{ eventoDetalle.grupoNumero }}: {{ eventoDetalle.materiaNombre }}
          </v-card-title>
        </v-card-item>
        <v-card-text class="pt-4">
          <p class="mb-2"><strong>Docente:</strong> {{ eventoDetalle.docente || 'No especificado' }}</p>
          <p class="mb-2"><strong>Aula:</strong> {{ eventoDetalle.aula || 'No especificada' }}</p>
          <p class="mb-0">
            <strong>Horario:</strong> {{ DIA_LABEL[eventoDetalle.dia] ?? eventoDetalle.dia }},
            {{ detalleHorario }}
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
          <p v-if="gestionTexto" class="horario-header__meta"><strong>Gestión:</strong> {{ gestionTexto }}</p>
          <p v-if="estudianteTexto" class="horario-header__meta">
            <strong>Nombre:</strong> {{ estudianteTexto }}
          </p>
        </template>
      </div>

      <!-- Alerta de choques -->
      <v-alert
        v-if="conflictos.lista.length"
        type="error"
        variant="tonal"
        density="compact"
        :class="mobile ? 'mb-2' : 'mb-3'"
        :icon="mdiAlertCircleOutline"
      >
        <div class="font-weight-bold mb-1">Choques de horario detectados:</div>
        <div v-for="(c, i) in conflictos.lista" :key="i" class="text-body-2">
          {{ c.materia1 }} (G{{ c.grupo1 }}) ↔ {{ c.materia2 }} (G{{ c.grupo2 }}) - {{ c.dia }}
        </div>
      </v-alert>

      <!-- Pestañas de día (solo mobile): filtran la agenda de abajo y saltan
           a la columna correspondiente del calendario completo -->
      <div v-if="mobile" class="dia-tabs mb-2">
        <button
          v-for="dia in DIAS_TABS"
          :key="dia.key"
          type="button"
          class="dia-tab"
          :class="{ 'dia-tab--active': diaActivoMobile === dia.key }"
          @click="irADia(dia.key)"
        >
          {{ dia.corto }}
          <span v-if="diasConConflicto.has(dia.key)" class="dia-tab__dot" />
        </button>
      </div>

      <!-- Agenda del día (solo mobile): lista vertical con el texto completo,
           sin los límites de ancho/alto de las celdas del calendario -->
      <div v-if="mobile" class="agenda-dia mb-3">
        <div v-if="eventosDelDiaActivo.length === 0" class="text-caption text-medium-emphasis text-center py-3">
          Sin clases este día
        </div>
        <div
          v-for="ev in eventosDelDiaActivo"
          :key="ev.grupoKey + ev.start"
          class="agenda-card"
          :style="{ borderLeftColor: ev.color }"
          @click="abrirDetalle(ev)"
        >
          <div class="agenda-card__hora">{{ ev.start.slice(11) }} - {{ ev.end.slice(11) }}</div>
          <div class="agenda-card__materia">G{{ ev.grupoNumero }}: {{ ev.materiaNombre }}</div>
          <div class="agenda-card__aula">
            <v-icon :icon="mdiMapMarker" size="14" />
            {{ ev.aula || 'Aula no especificada' }}
          </div>
          <div class="agenda-card__meta">{{ ev.docente }}</div>
        </div>
      </div>

      <p v-if="mobile" class="text-caption text-medium-emphasis mb-1">
        Vista semanal completa (para imprimir o descargar)
      </p>
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
          :weekday-format="weekdayFormat"
          :day-format="dayFormat"
          now="2000-01-01 00:00:00"
          locale="es"
          :style="mobile ? { minWidth: '880px' } : undefined"
        >
          <!-- Contenido custom de cada evento -->
          <template #event="{ event: ev }">
            <div class="semana-ev px-1" @click="abrirDetalle(ev as unknown as EventoCal)">
              <div class="semana-ev__name font-weight-bold">
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

      <!-- Leyenda de colores por materia -->
      <div v-if="leyenda.length" class="d-flex flex-wrap ga-3 mt-3 px-1">
        <div v-for="item in leyenda" :key="item.key" class="d-flex align-center ga-1">
          <span class="semana-dot" :style="{ background: item.color }" />
          <span class="text-caption">{{ item.texto }}</span>
        </div>
      </div>
    </div>
    <!-- /capturaRef -->
  </div>
</template>

<style scoped>
.calendar-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.dia-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.dia-tab {
  flex: 0 0 auto;
  position: relative;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid #cfd8e3;
  background: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  color: #37474f;
}
.dia-tab--active {
  background: #1565c0;
  border-color: #1565c0;
  color: #fff;
}
.dia-tab__dot {
  position: absolute;
  top: 3px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d32f2f;
}
.agenda-dia {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.agenda-card {
  border: 1px solid #e0e6f0;
  border-left: 4px solid #1976d2;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  cursor: pointer;
}
.agenda-card__hora {
  font-size: 0.72rem;
  font-weight: 600;
  color: #546279;
  margin-bottom: 2px;
}
.agenda-card__materia {
  font-size: 0.86rem;
  font-weight: 700;
  color: #14213d;
  line-height: 1.3;
  word-break: break-word;
}
.agenda-card__aula {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.84rem;
  font-weight: 700;
  color: #0d47a1;
  margin-top: 3px;
  word-break: break-word;
}
.agenda-card__meta {
  font-size: 0.78rem;
  color: #45526b;
  word-break: break-word;
  margin-top: 2px;
}
:deep(.v-calendar-daily_head-day-label) {
  display: none !important;
}
/* Vuetify ya fija la columna de horas a la izquierda (position:sticky) al
   scrollear horizontalmente, pero sin fondo propio los eventos de los días
   se ven "pasar por debajo" del texto. Se le da un fondo sólido y más
   z-index para que quede siempre legible por encima. */
:deep(.v-calendar-daily__intervals-head),
:deep(.v-calendar-daily__intervals-body) {
  background: #fff;
  z-index: 3;
}
/* Vuetify envuelve el calendario en sus propios contenedores internos que
   pueden terminar creando SU PROPIO scroll (aparte del que agregamos
   nosotros en .calendar-scroll-wrapper). Cuando eso pasa, la columna de
   horas queda "sticky" respecto al contenedor interno de Vuetify en vez
   del nuestro, y al saltar de día con las pestañas deja de quedar fija.
   Se anula ese scroll interno para que el único que scrollea sea el
   wrapper que controlamos, y así left:0 se calcule contra ese. */
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
