-- ============================================
-- Nombre y último ingreso en listar_roles_usuario()
-- ============================================
-- La pestaña "Roles" del panel de administración solo mostraba correo y
-- rol; se agrega el nombre (tomado de los metadatos que guarda el
-- proveedor de login, igual que ya hace AuthButton.vue en el menú de
-- cuenta) y la fecha del último ingreso, para que un administrador
-- pueda reconocer cada cuenta más fácil y notar sesiones inactivas.
--
-- Supabase no lleva un contador de inicios de sesión de fábrica (no hay
-- columna equivalente en auth.users) -- para eso haría falta una tabla
-- de auditoría propia incrementada en cada login, que no existe
-- todavía. `last_sign_in_at` es lo más cercano disponible sin agregar
-- esa infraestructura.

DROP FUNCTION IF EXISTS listar_roles_usuario();

CREATE FUNCTION listar_roles_usuario()
RETURNS TABLE (
  user_id uuid,
  email text,
  nombre text,
  rol rol_usuario,
  ultimo_ingreso timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
    SELECT
      ru.user_id,
      u.email::text,
      COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'nombre_completo',
        u.raw_user_meta_data ->> 'given_name'
      ),
      ru.rol,
      u.last_sign_in_at
    FROM roles_usuario ru
    JOIN auth.users u ON u.id = ru.user_id
    ORDER BY u.email;
END;
$$;
