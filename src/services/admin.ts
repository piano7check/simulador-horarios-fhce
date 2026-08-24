import { supabase } from '@/lib/supabase'

export interface GrupoAdmin {
  id: number
  numero: string
  aula_virtual: string | null
  whatsapp_grupo: string | null
}

export type RolUsuario = 'auxiliar' | 'docente' | 'administrador'

export async function obtenerMiRol(): Promise<RolUsuario | null> {
  const { data, error } = await supabase.rpc('mi_rol')
  if (error) throw error
  return (data as RolUsuario | null) ?? null
}

export async function obtenerGruposAdmin(
  materiaId: number,
  gestion: string,
): Promise<GrupoAdmin[]> {
  const { data, error } = await supabase.rpc('obtener_grupos_admin', {
    p_materia_id: materiaId,
    p_gestion: gestion,
  })
  if (error) throw error
  return data as GrupoAdmin[]
}

export async function actualizarGrupoExtra(
  grupoId: number,
  aulaVirtual: string | null,
  whatsappGrupo: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('grupos')
    .update({ aula_virtual: aulaVirtual, whatsapp_grupo: whatsappGrupo })
    .eq('id', grupoId)
  if (error) throw error
}
