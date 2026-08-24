import { supabase } from '@/lib/supabase'
import { conCache } from '@/utils/cacheLocal'

// Gestión (semestre) que consulta toda la app. Un solo lugar para
// actualizar cuando cambie el semestre — antes estaba repetida como
// constante local en PlanificadorView.vue y AdminView.vue, con el riesgo
// de actualizar una y olvidarse la otra.
// TODO: hacerlo dinámico (leer la gestión vigente desde la base en vez de
// hardcodearla).
export const GESTION_ACTUAL = '2/2026'

// TTLs elegidos según el riesgo de cada dato si queda desactualizado.
// Nombres de carrera/materia: bajo riesgo, se refrescan con menos frecuencia.
const TTL_METADATA = 60 * 60 * 1000 // 1h
// Día/hora/aula/docente de cada grupo: es lo que decide si el estudiante
// llega bien a clase, así que se revalida seguido apenas hay conexión.
const TTL_CLASES = 10 * 60 * 1000 // 10min

// -- Tipos ----------------------------------------------

export interface Carrera {
  id: number
  nombre: string
  last_scraped_at?: string | null
}

export interface Materia {
  id: number
  codigo: string
  nombre: string
  nivel_codigo: string
  nivel_nombre: string
}

export interface Clase {
  grupo_numero: string
  dia: string
  docente: string
  aula: string
  hora_inicio: string
  hora_fin: string
  aula_virtual: string | null
  whatsapp_grupo: string | null
}

export interface DocenteMateria {
  materia_id: number
  docente: string
}

export interface CargaResult {
  ok: boolean
  materias: number
  grupos: number
  clases: number
}

// -- Servicios ------------------------------------------

export async function obtenerCarreras(facultadId: number): Promise<Carrera[]> {
  return conCache(`carreras:${facultadId}`, TTL_METADATA, async () => {
    const { data, error } = await supabase.rpc('obtener_carreras_por_facultad', {
      p_facultad_id: facultadId,
    })
    if (error) throw error
    return data as Carrera[]
  })
}

export async function obtenerMaterias(carreraId: number): Promise<Materia[]> {
  return conCache(`materias:${carreraId}`, TTL_METADATA, async () => {
    const { data, error } = await supabase.rpc('obtener_materias_por_carrera', {
      p_carrera_id: carreraId,
    })
    if (error) throw error
    return data as Materia[]
  })
}

export async function obtenerDocentesPorCarrera(
  carreraId: number,
  gestion: string,
): Promise<DocenteMateria[]> {
  return conCache(`docentes:${carreraId}:${gestion}`, TTL_METADATA, async () => {
    const { data, error } = await supabase.rpc('obtener_docentes_por_carrera', {
      p_carrera_id: carreraId,
      p_gestion: gestion,
    })
    if (error) throw error
    return data as DocenteMateria[]
  })
}

export async function obtenerClases(materiaId: number, gestion: string): Promise<Clase[]> {
  return conCache(`clases:${materiaId}:${gestion}`, TTL_CLASES, async () => {
    const { data, error } = await supabase.rpc('obtener_clases_por_materia', {
      p_materia_id: materiaId,
      p_gestion: gestion,
    })
    if (error) throw error
    return data as Clase[]
  })
}

export async function cargarHorarios(payload: {
  carrera_id: number
  gestion: string
  niveles: {
    codigo: string
    nombre: string
    materias: {
      nombre: string
      codigo: string
      grupos: {
        numero: number
        clases: {
          dia: string
          docente: string
          aula: string
          hora_inicio: string
          hora_fin: string
        }[]
      }[]
    }[]
  }[]
}): Promise<CargaResult> {
  const { data, error } = await supabase.rpc('cargar_horarios', { payload })
  if (error) throw error
  return data as CargaResult
}
