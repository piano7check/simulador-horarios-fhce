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

/**
 * Cachea en localStorage el resultado de `fetcher`, pensado para datos que
 * casi no cambian (catálogo de materias/horarios). La mayoría de usuarios
 * son estudiantes con datos móviles limitados y señal inestable en la
 * universidad, así que mientras el cache esté fresco no se hace ninguna
 * llamada de red, y si la red falla o tarda se usa el último dato conocido
 * en vez de mostrar un error.
 */
export async function conCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = leerCache<T>(key)
  const fresco = cached !== null && Date.now() - cached.fetchedAt < ttlMs
  if (cached && fresco) return cached.data

  if (cached && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return cached.data
  }

  try {
    const data = await conTimeout(fetcher(), 8000)
    escribirCache(key, data)
    return data
  } catch (err) {
    if (cached) return cached.data
    throw err
  }
}
