-- ============================================
-- listar_estudiantes(): usuarios registrados sin rol de staff
-- ============================================
-- La pestaña "Roles" del panel de administración solo lista cuentas con
-- auxiliar/docente/administrador. Se agrega una función para ver, en
-- una pestaña aparte, a los estudiantes comunes (cualquier cuenta
-- registrada que NO tenga un rol) con sus estadísticas de uso -- mismo
-- criterio de seguridad que el resto de funciones de este módulo: solo
-- administrador, SECURITY DEFINER porque auth.users no es accesible por
-- la API pública.

CREATE FUNCTION listar_estudiantes()
RETURNS TABLE (
  user_id uuid,
  email text,
  nombre text,
  ultimo_ingreso timestamptz,
  ingresos integer,
  vistas integer
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
      u.id,
      u.email::text,
      COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'nombre_completo',
        u.raw_user_meta_data ->> 'given_name'
      ),
      u.last_sign_in_at,
      COALESCE(ei.ingresos, 0),
      COALESCE(ei.vistas, 0)
    FROM auth.users u
    LEFT JOIN estadisticas_ingreso ei ON ei.user_id = u.id
    WHERE NOT EXISTS (SELECT 1 FROM roles_usuario ru WHERE ru.user_id = u.id)
    ORDER BY u.last_sign_in_at DESC NULLS LAST
    LIMIT 500;
END;
$$;
