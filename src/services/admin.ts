import { supabase } from '@/lib/supabase'

export interface GrupoAdmin {
  id: number
  numero: string
  aula_virtual: string | null
  whatsapp_docente: string | null
  whatsapp_auxiliar: string | null
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
  datos: {
    aulaVirtual: string | null
    whatsappDocente: string | null
    whatsappAuxiliar: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('grupos')
    .update({
      aula_virtual: datos.aulaVirtual,
      whatsapp_docente: datos.whatsappDocente,
      whatsapp_auxiliar: datos.whatsappAuxiliar,
    })
    .eq('id', grupoId)
  if (error) throw error
}
