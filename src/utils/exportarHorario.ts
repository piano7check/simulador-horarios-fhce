import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

/**
 * Carta horizontal: 279.4 × 215.9 mm
 * Con márgenes de 12 mm → área útil: 255.4 × 191.9 mm
 */
const MARGEN = 12 // mm
const ANCHO_PDF = 279.4
const ALTO_PDF = 215.9
const AREA_W = ANCHO_PDF - MARGEN * 2
const AREA_H = ALTO_PDF - MARGEN * 2

interface ExportOpts {
  /** Elemento DOM del calendario + leyenda */
  elemento: HTMLElement
  titulo: string
  subtitulo?: string
  gestion?: string
  estudiante?: string
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c])
}

// Parse basic CSS color strings (rgb(...), rgba(...), #rrggbb, #rgb)
function parseColorToHex(input?: string): string | null {
  if (!input) return null
  input = input.trim()
  // rgb/rgba
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/i.exec(input)
  if (rgb) {
    const r = Number(rgb[1])
    const g = Number(rgb[2])
    const b = Number(rgb[3])
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  // hex
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input)
  if (hex && hex[1]) {
    let v = hex[1]
    if (v && v.length === 3) v = v.split('').map((c) => c + c).join('')
    return '#' + v.toLowerCase()
  }
  return null
}

function darkenHex(hex: string, amount = 0.15): string {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    const nr = Math.max(0, Math.min(255, Math.round(r * (1 - amount))))
    const ng = Math.max(0, Math.min(255, Math.round(g * (1 - amount))))
    const nb = Math.max(0, Math.min(255, Math.round(b * (1 - amount))))
    return '#' + [nr, ng, nb].map((n) => n.toString(16).padStart(2, '0')).join('')
  } catch (e) {
    return hex
  }
}

function lightenHex(hex: string, amount = 0.85): string {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    const nr = Math.max(0, Math.min(255, Math.round(r + (255 - r) * amount)))
    const ng = Math.max(0, Math.min(255, Math.round(g + (255 - g) * amount)))
    const nb = Math.max(0, Math.min(255, Math.round(b + (255 - b) * amount)))
    return '#' + [nr, ng, nb].map((n) => n.toString(16).padStart(2, '0')).join('')
  } catch (e) {
    return hex
  }
}

/** CSS compartido por la tabla del horario, tanto para imprimir como para
 * generar el PDF/descarga — así ambas salidas se ven siempre igual, sin
 * depender de qué tan angosta esté la vista (celular o escritorio). */
const TABLA_STYLE_CSS = `
  .calendario-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 12px; background: #fff; }
  .print-header { margin-bottom: 10px; text-align: center; color: #1f1f1f; }
  .print-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 3px; }
  .print-subtitle { font-size: 0.86rem; margin-bottom: 2px; color: #333; }
  .print-meta { font-size: 0.82rem; color: #444; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; background-color: #fcfcfc; table-layout: fixed; }
  th { background-color: #4a90e2; color: white; padding: 8px; border: 1px solid #ddd; font-size: 0.85em; }
  td { border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 0.75em; min-height: 24px; vertical-align: middle; min-width: 0; }
  .hora-col { background-color: #f2f2f2; font-weight: bold; font-size: 0.68rem; width: 112px; max-width: 112px; text-align: center; white-space: nowrap; padding: 2px 4px; }
  .clase-item { background-color: #e3f2fd; border-radius: 4px; padding: 4px 6px; border-left: 4px solid #2196f3; display: block; max-width: 100%; min-width: 0; white-space: normal; word-break: break-word; }
  .lista-clases { margin-top: 18px; padding: 10px; background: #f9f9f9; border-radius: 6px; font-size: 0.8em; }
  .legend-list { column-count: 2; column-gap: 16px; list-style: none; padding-left: 0; margin: 0 }
  .legend-list li { break-inside: avoid; }
  /* Sin límite de líneas: el texto siempre se ve completo, la fila crece
     lo que haga falta (la imagen/PDF se reescala para seguir entrando en
     una página, nunca se recorta el contenido). */
  .clase-title { font-weight: 600; font-size: 0.8em; }
  .clase-detail, .clase-aula { font-size: 0.72em; color: #444; }
  th, td, .clase-item, .clase-title, .clase-detail, .clase-aula { box-sizing: border-box; }
`

/**
 * Reconstruye la grilla semanal completa (6 días) a partir del DOM del
 * calendario, leyendo posición/hora de cada evento con independencia de
 * cómo se vea la vista actual (celular con agenda de un día, o escritorio
 * con la grilla completa). Así impresión y descarga siempre muestran la
 * semana entera, nunca un recorte de lo que estaba visible en pantalla.
 */
function buildCalendarioBodyHtml(
  elemento: HTMLElement,
  meta?: Pick<ExportOpts, 'titulo' | 'subtitulo' | 'gestion' | 'estudiante'>,
): string {
  try {
    const dayContainers = Array.from(elemento.querySelectorAll('.v-calendar-daily__day')) as HTMLElement[]
    if (!dayContainers.length) return ''

    const rows = 11
    const startHour = 6
    const startMinute = 45
    const minutesStep = 90
    const times: string[] = []
    for (let i = 0; i < rows; i++) {
      const startTotal = startHour * 60 + startMinute + i * minutesStep
      const endTotal = startTotal + minutesStep
      const sh = Math.floor(startTotal / 60)
      const sm = startTotal % 60
      const eh = Math.floor(endTotal / 60)
      const em = endTotal % 60
      const startStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
      const endStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
      times.push(`${startStr} - ${endStr}`)
    }

    const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: 6 }, () => ''))
    const firstInterval = elemento.querySelector('.v-calendar-daily__interval') as HTMLElement | null
    const intervalPx = firstInterval ? (parseFloat(window.getComputedStyle(firstInterval).height) || 44) : 44

    const events = Array.from(elemento.querySelectorAll('.v-event-timed')) as HTMLElement[]
    events.forEach((ev) => {
      const dayEl = ev.closest('.v-calendar-daily__day') as HTMLElement | null
      const dayIndex = dayEl ? dayContainers.indexOf(dayEl) : -1
      if (dayIndex < 0 || dayIndex > 5) return
      let topPx = 0
      const style = ev.getAttribute('style') || ''
      const m = /top:\s*([0-9.]+)px/.exec(style)
      if (m) topPx = parseFloat(m[1]!)
      else {
        const cs = window.getComputedStyle(ev)
        topPx = parseFloat(cs.top || '0') || 0
      }
      const row = Math.max(0, Math.min(rows - 1, Math.floor(topPx / intervalPx)))
      if (row < 0 || row >= rows) return
      const nameEl = ev.querySelector('.semana-ev__name')
      const name = nameEl ? (nameEl.textContent || '').trim() : (ev.textContent || '').trim() || ''
      // El aula va primero en la celda (semana-ev__detail--aula), el docente después
      const details = Array.from(ev.querySelectorAll('.semana-ev__detail')).map((d) => (d.textContent || '').trim())
      const aula = details[0] ?? ''
      const teacher = details[1] ?? ''
      // Extraer color del elemento (inline style o computed style)
      const cs = window.getComputedStyle(ev)
      let bg = ''
      const inlineStyle = ev.getAttribute('style') || ''
      const mColor = /background(?:-color)?:\s*([^;]+)/i.exec(inlineStyle)
      if (mColor && mColor[1]) bg = mColor[1].trim()
      if (!bg) bg = cs.backgroundColor || ''
        const bgHex = parseColorToHex(bg) || '#e3f2fd'
        // Use a very light background (blend towards white) so printed cells
        // are nearly white and text remains black for maximum contrast.
        const bgLight = lightenHex(bgHex, 0.88)
        const borderHex = darkenHex(bgHex, 0.18)
        const textColor = '#000000'

      const content = `<div class=\"clase-item\" style=\"background:${bgLight};border-left-color:${borderHex};color:${textColor}\"><div class=\"clase-title\">${escapeHtml(String(name))}<\/div><div class=\"clase-detail\">${escapeHtml(String(teacher))}<\/div><div class=\"clase-aula\">${escapeHtml(String(aula))}<\/div><\/div>`
      const prev = grid[row]![dayIndex] || ''
      grid[row]![dayIndex] = prev ? prev + '<hr/>' + content : content
    })

    let html = '<div class="calendario-container">'

    if (meta?.titulo || meta?.subtitulo || meta?.gestion || meta?.estudiante) {
      html += '<div class="print-header">'
      if (meta?.titulo) html += `<div class="print-title">${escapeHtml(meta.titulo)}</div>`
      if (meta?.subtitulo) html += `<div class="print-subtitle">${escapeHtml(meta.subtitulo)}</div>`
      if (meta?.gestion) html += `<div class="print-meta"><strong>Gestion:</strong> ${escapeHtml(meta.gestion)}</div>`
      if (meta?.estudiante) html += `<div class="print-meta"><strong>Nombre:</strong> ${escapeHtml(meta.estudiante)}</div>`
      html += '</div>'
    }

    html += '<table>'
    html += '<colgroup><col style="width:112px" /><col /><col /><col /><col /><col /><col /></colgroup>'
    html += '<thead><tr><th>Horario</th><th>Lunes</th><th>Martes</th><th>Miércoles</th><th>Jueves</th><th>Viernes</th><th>Sábado</th></tr></thead><tbody>'
    for (let r = 0; r < rows; r++) {
      html += '<tr>'
      html += `<td class="hora-col">${times[r]}</td>`
      for (let d = 0; d < 6; d++) html += `<td>${(grid[r] && grid[r]![d]) || ''}</td>`
      html += '</tr>'
    }
    html += '</tbody></table>'

    // Construir leyenda con colores: extraer títulos únicos y color desde las celdas
    const legendItems: Record<string, { color: string }> = {}
    for (let r = 0; r < rows; r++) for (let d = 0; d < 6; d++) if (grid[r] && grid[r]![d]) {
      const cell = grid[r]![d] as string
      const m = cell.match(/<div class="clase-title">([^<]+)<\/div>/)
      const colorMatch = cell.match(/style="[^"]*background:([^;"]+)[;"]/)
      const color = colorMatch ? (colorMatch[1] || '').trim() : ''
      if (m && m[1]) legendItems[m[1]] = { color: parseColorToHex(color) || '#e3f2fd' }
    }
    html += '<div class="lista-clases"><h3>Resumen de Clases</h3><ul class="legend-list">'
    for (const key of Object.keys(legendItems).slice(0, 200)) {
      const col = legendItems[key]!.color
      // Show a solid swatch matching the original cell color so legend and table match
      html += `<li style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="display:inline-block;width:18px;height:12px;background:${col};border-radius:2px"></span><strong style="color:#000">${escapeHtml(key)}</strong></li>`
    }
    html += '</ul></div>'

    html += '</div>'
    return html
  } catch (e) {
    console.error('buildCalendarioBodyHtml error', e)
    return ''
  }
}

function generatePrintableHTMLFromCalendar(elemento: HTMLElement, meta?: Pick<ExportOpts, 'titulo' | 'subtitulo' | 'gestion' | 'estudiante'>): string {
  const bodyHtml = buildCalendarioBodyHtml(elemento, meta)
  if (!bodyHtml) return ''

  const printOnlyCss = `
    @page { size: letter landscape; margin: 8mm; }
    body { margin: 0; padding: 8mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `

  let html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  html += `<title>Horario - impresión</title>`
  html += `<style>${TABLA_STYLE_CSS}${printOnlyCss}</style>`
  html += '</head><body>' + bodyHtml + '</body></html>'
  return html
}

/**
 * Renderiza la tabla del horario (misma reconstrucción que usa impresión)
 * en un contenedor oculto fuera de pantalla, y la captura con html2canvas.
 * Al no depender de lo que esté visible en el viewport actual, la imagen
 * resultante es siempre la semana completa, sea que se exporte desde
 * celular o desde escritorio.
 */
async function renderTablaACanvas(
  elemento: HTMLElement,
  meta: Pick<ExportOpts, 'titulo' | 'subtitulo' | 'gestion' | 'estudiante'>,
  anchoPx: number,
): Promise<HTMLCanvasElement | null> {
  const bodyHtml = buildCalendarioBodyHtml(elemento, meta)
  if (!bodyHtml) return null

  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = `${anchoPx}px`
  container.style.background = '#ffffff'
  container.innerHTML = `<style>${TABLA_STYLE_CSS}</style>${bodyHtml}`
  document.body.appendChild(container)

  try {
    try {
      const fonts: any = (document as any).fonts
      if (fonts && 'ready' in fonts && fonts.ready instanceof Promise) await fonts.ready
    } catch (e) {
      // ignore
    }
    return await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  } finally {
    container.remove()
  }
}

function buildNombreArchivo(opts: ExportOpts, ext: string): string {
  let nombre = opts.titulo.replace(/\s+/g, '_').toLowerCase()
  if (opts.subtitulo) nombre += `_${opts.subtitulo.replace(/\s+/g, '_').toLowerCase()}`
  return `${nombre}.${ext}`
}

/** Genera el canvas de la semana completa reconstruida desde el calendario,
 * a la resolución usada tanto para el PDF como para la imagen. */
async function renderCanvasParaExport(opts: ExportOpts): Promise<HTMLCanvasElement> {
  const { elemento, titulo, subtitulo, gestion, estudiante } = opts
  const pxPerMm = 96 / 25.4
  const anchoPx = Math.round(AREA_W * pxPerMm)

  const canvas = await renderTablaACanvas(elemento, { titulo, subtitulo, gestion, estudiante }, anchoPx)
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error('No se pudo generar el horario para exportar')
  }
  return canvas
}

async function generarPDF(opts: ExportOpts): Promise<jsPDF> {
  const canvas = await renderCanvasParaExport(opts)
  const pxPerMm = 96 / 25.4
  const scale = 2
  const imageWidthMm = canvas.width / scale / pxPerMm
  const imageHeightMm = canvas.height / scale / pxPerMm
  const scaleFactor = Math.min(AREA_W / imageWidthMm, AREA_H / imageHeightMm, 1)
  const finalW = imageWidthMm * scaleFactor
  const finalH = imageHeightMm * scaleFactor

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
  if (!blob) throw new Error('No blob')
  const imgData = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Error reading blob'))
    fr.readAsDataURL(blob)
  })

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const offsetX = MARGEN + Math.max(0, (AREA_W - finalW) / 2)
  const offsetY = MARGEN
  pdf.addImage(imgData, 'PNG', offsetX, offsetY, finalW, finalH)
  return pdf
}

async function openPrintWindowPreserveText(opts: ExportOpts): Promise<boolean> {
  try {
    const tableHtml = generatePrintableHTMLFromCalendar(opts.elemento, {
      titulo: opts.titulo,
      subtitulo: opts.subtitulo,
      gestion: opts.gestion,
      estudiante: opts.estudiante,
    })
    if (!tableHtml) return false

    const w = window.open('', '_blank') as Window | null
    if (!w) return false

    const doc = w.document
    doc.open()
    doc.write(tableHtml)

    try {
      const fonts: any = (w.document as any).fonts || (document as any).fonts
      if (fonts && 'ready' in fonts && fonts.ready instanceof Promise) await fonts.ready
    } catch (e) {
      // ignore
    }

    doc.close()
    w.focus()
    setTimeout(() => { try { w.print() } catch (e) { /* nothing */ } }, 500)
    return true
  } catch (err) {
    console.error('openPrintWindowPreserveText error', err)
    return false
  }
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Siempre genera un PDF carta horizontal con la semana completa, sin
 * importar si se llamó desde la vista de celular o de escritorio. */
export async function descargarHorario(opts: ExportOpts): Promise<void> {
  const pdf = await generarPDF(opts)
  const filename = buildNombreArchivo(opts, 'pdf')

  try {
    descargarBlob(pdf.output('blob') as Blob, filename)
    return
  } catch (err) {
    try { pdf.save(filename); return } catch (e) { console.error('Error al descargar PDF:', e); throw e }
  }
}

/** Igual que descargarHorario, pero como imagen PNG en vez de PDF — misma
 * reconstrucción de la semana completa, sin depender de la vista actual. */
export async function descargarHorarioImagen(opts: ExportOpts): Promise<void> {
  const canvas = await renderCanvasParaExport(opts)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95))
  if (!blob) throw new Error('No se pudo generar la imagen')
  descargarBlob(blob, buildNombreArchivo(opts, 'png'))
}

export async function imprimirHorario(opts: ExportOpts): Promise<void> {
  const tried = await openPrintWindowPreserveText(opts)
  if (tried) return

  const pdf = await generarPDF(opts)
  try {
    const blob = pdf.output('blob') as Blob
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    if (!w) {
      const a = document.createElement('a')
      a.href = url
      a.download = 'horario.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  } catch (e) {
    console.error('Error al abrir PDF para imprimir:', e)
    try { const blobUrl = pdf.output('bloburl'); window.open(blobUrl as unknown as string, '_blank') } catch (err) { console.error('Error fallback imprimir:', err) }
  }
}
