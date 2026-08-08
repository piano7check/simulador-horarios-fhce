import { supabase } from '@/lib/supabase'

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
