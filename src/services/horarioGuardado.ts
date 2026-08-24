import { supabase } from '@/lib/supabase'

/** IDs de las carreras para las que el usuario ya tiene un horario
 * guardado, sin necesidad de saber de antemano cuál — para que, al
 * iniciar sesión, la app pueda saltarse la pantalla de "elegir carrera"
 * cuando ya hay una obvia. */
export async function obtenerCarrerasConHorarioGuardado(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('horarios_guardados')
    .select('carrera_id, grupos')
    .eq('user_id', userId)
  if (error) throw error
  // Una fila con grupos: [] (quedó así al sacar todas las materias, ver
  // guardarHorario) no cuenta como un horario guardado de verdad.
  return (data ?? [])
    .filter((r) => Array.isArray(r.grupos) && r.grupos.length > 0)
    .map((r) => r.carrera_id as number)
}

export async function cargarHorario(userId: string, carreraId: number): Promise<string[]> {
  const { data } = await supabase
    .from('horarios_guardados')
    .select('grupos')
    .eq('user_id', userId)
    .eq('carrera_id', carreraId)
    .single()
  return (data?.grupos as string[]) ?? []
}

export async function guardarHorario(
  userId: string,
  carreraId: number,
  grupos: string[],
): Promise<void> {
  // Sin materias, no queda nada que guardar — se borra la fila en vez de
  // dejarla con grupos: [], para no confundir "vació su horario" con
  // "tiene un horario guardado" en el resto de la app (por ejemplo, al
  // decidir si saltar la pantalla de elegir carrera).
  if (grupos.length === 0) {
    const { error } = await supabase
      .from('horarios_guardados')
      .delete()
      .eq('user_id', userId)
      .eq('carrera_id', carreraId)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('horarios_guardados').upsert(
    {
      user_id: userId,
      carrera_id: carreraId,
      grupos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,carrera_id' },
  )
  if (error) throw error
}
