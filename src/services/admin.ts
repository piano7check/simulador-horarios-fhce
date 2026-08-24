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

export interface UsuarioConRol {
  user_id: string
  email: string
  rol: RolUsuario
}

/** Solo administrador puede llamar esto (lo verifica la función en la
 * base); si no, tira error. */
export async function buscarUsuarioPorEmail(
  email: string,
): Promise<{ user_id: string; email: string } | null> {
  const { data, error } = await supabase.rpc('buscar_usuario_por_email', { p_email: email })
  if (error) throw error
  const fila = (data as { user_id: string; email: string }[])[0]
  return fila ?? null
}

export async function listarRolesUsuario(): Promise<UsuarioConRol[]> {
  const { data, error } = await supabase.rpc('listar_roles_usuario')
  if (error) throw error
  return data as UsuarioConRol[]
}

export async function asignarRol(userId: string, rol: RolUsuario): Promise<void> {
  const { error } = await supabase.rpc('asignar_rol', { p_user_id: userId, p_rol: rol })
  if (error) throw error
}

export async function quitarRol(userId: string): Promise<void> {
  const { error } = await supabase.rpc('quitar_rol', { p_user_id: userId })
  if (error) throw error
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
