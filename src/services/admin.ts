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
  nombre: string | null
  rol: RolUsuario
  ultimo_ingreso: string | null
  ingresos: number
  vistas: number
}

export interface UsuarioEncontrado {
  user_id: string
  email: string
  nombre: string | null
}

/** Búsqueda parcial por correo o nombre, para elegir a quién asignar un
 * rol. Solo administrador puede llamar esto (lo verifica la función en
 * la base); si no, tira error. */
export async function buscarUsuarios(termino: string): Promise<UsuarioEncontrado[]> {
  const { data, error } = await supabase.rpc('buscar_usuarios', { p_termino: termino })
  if (error) throw error
  return data as UsuarioEncontrado[]
}

export async function listarRolesUsuario(): Promise<UsuarioConRol[]> {
  const { data, error } = await supabase.rpc('listar_roles_usuario')
  if (error) throw error
  return data as UsuarioConRol[]
}

export interface Estudiante {
  user_id: string
  email: string
  nombre: string | null
  ultimo_ingreso: string | null
  ingresos: number
  vistas: number
}

/** Cuentas registradas sin rol de staff, con sus estadísticas de uso. */
export async function listarEstudiantes(): Promise<Estudiante[]> {
  const { data, error } = await supabase.rpc('listar_estudiantes')
  if (error) throw error
  return data as Estudiante[]
}

export async function asignarRol(userId: string, rol: RolUsuario): Promise<void> {
  const { error } = await supabase.rpc('asignar_rol', { p_user_id: userId, p_rol: rol })
  if (error) throw error
}

export async function quitarRol(userId: string): Promise<void> {
  const { error } = await supabase.rpc('quitar_rol', { p_user_id: userId })
  if (error) throw error
}

/** Estadísticas para el panel de admin, no algo de lo que dependa el
 * resto de la app -- nunca deben bloquear ni mostrar error si fallan
 * (por ejemplo, sin conexión), así que se disparan sin esperar. */
export function registrarIngreso(): void {
  supabase.rpc('registrar_ingreso').then(
    () => {},
    () => {},
  )
}

export function registrarVista(): void {
  supabase.rpc('registrar_vista').then(
    () => {},
    () => {},
  )
}

export interface Docente {
  id: number
  nombre_completo: string
  foto_url: string | null
  descripcion: string | null
}

/** Búsqueda parcial por nombre, para elegir a qué docente cargarle foto
 * y descripción. `docentes` ya es de lectura pública. */
export async function buscarDocentes(termino: string): Promise<Docente[]> {
  const { data, error } = await supabase
    .from('docentes')
    .select('id, nombre_completo, foto_url, descripcion')
    .ilike('nombre_completo', `%${termino}%`)
    .order('nombre_completo')
    .limit(20)
  if (error) throw error
  return data as Docente[]
}

export async function actualizarDocente(
  docenteId: number,
  datos: { fotoUrl: string | null; descripcion: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('docentes')
    .update({ foto_url: datos.fotoUrl, descripcion: datos.descripcion })
    .eq('id', docenteId)
  if (error) throw error
}

/** Sube una foto al bucket `docentes-fotos` y devuelve su URL pública
 * (todavía no queda guardada en `docentes.foto_url` -- eso lo hace
 * actualizarDocente al guardar el formulario). Un mismo docente siempre
 * usa la misma ruta (se pisa con upsert), con un parámetro `t` en la URL
 * para que el navegador no siga mostrando la foto vieja en caché. */
export async function subirFotoDocente(docenteId: number, archivo: File): Promise<string> {
  const extension = archivo.name.split('.').pop() ?? 'jpg'
  const ruta = `${docenteId}.${extension}`
  const { error } = await supabase.storage
    .from('docentes-fotos')
    .upload(ruta, archivo, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('docentes-fotos').getPublicUrl(ruta)
  return `${data.publicUrl}?t=${Date.now()}`
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
