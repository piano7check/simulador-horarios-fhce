import { ref } from 'vue'

const PREFIX = 'hcache:'

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

function leerCache<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

function escribirCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, fetchedAt: Date.now() } satisfies CacheEntry<T>))
  } catch {
    // localStorage lleno o deshabilitado (modo privado, etc.): no es crítico, se sigue sin cache
  }
}

function conTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

// Si la red ya falló hace poco para una key, no se reintenta en cada
// clic mientras dure el corte: en la universidad la señal se corta y
// vuelve seguido, y sin esto cada interacción se quedaría colgada hasta
// 8s de nuevo. Es en memoria (no localStorage): al recargar la página se
// le da otra oportunidad a la red.
const fallasRecientes = new Map<string, number>()
const VENTANA_SIN_REINTENTAR = 30_000

/**
 * true si la última llamada a `conCache` tuvo que usar una copia local en
 * vez del dato real (sin conexión, red caída/lenta, o un corte reciente).
 * Un horario, aula o docente desactualizado puede hacer que un estudiante
 * falte a clase, así que la UI debe avisar explícitamente cuando esto pasa
 * en vez de mostrar el dato viejo como si fuera confiable.
 */
export const usandoDatosSinConexion = ref(false)

/**
 * Cachea en localStorage el resultado de `fetcher`. Mientras el dato esté
 * dentro de `ttlMs` no se vuelve a pedir por red (ahorra datos móviles y
 * evita quedarse colgado en cada clic durante un corte de señal). Al
 * vencer el TTL se intenta la red de nuevo para no quedarse con
 * información vieja; si falla, tarda más de 8s, o no hay conexión, se usa
 * el último dato conocido y se marca `usandoDatosSinConexion` para que la
 * interfaz avise que podría no ser exacto.
 *
 * `ttlMs` debe elegirse según el riesgo de cada dato: bajo para lo que
 * decide si el estudiante llega bien a clase (aula/hora/docente), más alto
 * para metadata de bajo riesgo (nombres de materias, carreras).
 */
export async function conCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = leerCache<T>(key)
  const fresco = cached !== null && Date.now() - cached.fetchedAt < ttlMs
  if (cached && fresco) return cached.data

  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const falloHacePoco = (fallasRecientes.get(key) ?? 0) > Date.now() - VENTANA_SIN_REINTENTAR

  if (cached && (offline || falloHacePoco)) {
    usandoDatosSinConexion.value = true
    return cached.data
  }

  try {
    const data = await conTimeout(fetcher(), 8000)
    escribirCache(key, data)
    fallasRecientes.delete(key)
    usandoDatosSinConexion.value = false
    return data
  } catch (err) {
    fallasRecientes.set(key, Date.now())
    if (cached) {
      usandoDatosSinConexion.value = true
      return cached.data
    }
    throw err
  }
}
