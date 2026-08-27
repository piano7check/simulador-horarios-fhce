-- ============================================
-- Buscar usuarios por nombre o correo (para asignar roles)
-- ============================================
-- Hasta ahora, para dar un rol el administrador tenía que escribir el
-- correo exacto de la cuenta (buscar_usuario_por_email). Se reemplaza
-- por una búsqueda parcial que coincide tanto por correo como por
-- nombre (de los metadatos del proveedor de login), para poder tipear
-- de a poco y elegir de una lista -- igual que ya se busca materia o
-- docente en el planificador.

DROP FUNCTION IF EXISTS buscar_usuario_por_email(text);

CREATE FUNCTION buscar_usuarios(p_termino text)
RETURNS TABLE (user_id uuid, email text, nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email::text,
      COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'nombre_completo',
        u.raw_user_meta_data ->> 'given_name'
      )
    FROM auth.users u
    WHERE
      u.email ILIKE '%' || p_termino || '%'
      OR COALESCE(u.raw_user_meta_data ->> 'full_name', '') ILIKE '%' || p_termino || '%'
      OR COALESCE(u.raw_user_meta_data ->> 'name', '') ILIKE '%' || p_termino || '%'
      OR COALESCE(u.raw_user_meta_data ->> 'nombre_completo', '') ILIKE '%' || p_termino || '%'
    ORDER BY u.email
    LIMIT 20;
END;
$$;
