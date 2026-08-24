import { supabase } from '@/lib/supabase'

/** IDs de las carreras para las que el usuario ya tiene un horario
 * guardado, sin necesidad de saber de antemano cuál — para que, al
 * iniciar sesión, la app pueda saltarse la pantalla de "elegir carrera"
 * cuando ya hay una obvia. */
export async function obtenerCarrerasConHorarioGuardado(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('horarios_guardados')
    .select('carrera_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => r.carrera_id as number)
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
