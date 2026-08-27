-- ============================================
-- Estadísticas de uso por usuario: ingresos y vistas
-- ============================================
-- El panel de administración solo mostraba el último ingreso; se agrega
-- un conteo de cuántas veces inició sesión y cuántas pantallas visitó,
-- para que un administrador tenga una idea más completa del uso real de
-- cada cuenta.
--
-- Se guarda en una tabla propia (no se puede alterar auth.users) con RLS
-- habilitado y sin políticas -- nadie lee ni escribe esta tabla directo
-- por la API pública. Solo se escribe a través de las RPC de abajo
-- (SECURITY DEFINER), que solo tocan la fila de auth.uid(), nunca la de
-- otro usuario -- no reciben un user_id como parámetro, así que no hay
-- forma de que una cuenta manipule las estadísticas de otra. Solo se lee
-- a través de listar_roles_usuario(), ya restringida a administrador.

CREATE TABLE estadisticas_ingreso (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ingresos integer NOT NULL DEFAULT 0,
  vistas integer NOT NULL DEFAULT 0
);

ALTER TABLE estadisticas_ingreso ENABLE ROW LEVEL SECURITY;

-- ============================================
-- registrar_ingreso(): un inicio de sesión real (se llama una vez por
-- evento SIGNED_IN, igual que signInPulse en useAuth.ts).
-- ============================================

CREATE FUNCTION registrar_ingreso()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO estadisticas_ingreso (user_id, ingresos, vistas)
  VALUES (auth.uid(), 1, 0)
  ON CONFLICT (user_id) DO UPDATE SET ingresos = estadisticas_ingreso.ingresos + 1;
END;
$$;

-- ============================================
-- registrar_vista(): una navegación dentro de la app (se llama en cada
-- cambio de ruta, solo si hay sesión).
-- ============================================

CREATE FUNCTION registrar_vista()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO estadisticas_ingreso (user_id, ingresos, vistas)
  VALUES (auth.uid(), 0, 1)
  ON CONFLICT (user_id) DO UPDATE SET vistas = estadisticas_ingreso.vistas + 1;
END;
$$;

-- ============================================
-- listar_roles_usuario(): se agregan ingresos y vistas.
-- ============================================

DROP FUNCTION IF EXISTS listar_roles_usuario();

CREATE FUNCTION listar_roles_usuario()
RETURNS TABLE (
  user_id uuid,
  email text,
  nombre text,
  rol rol_usuario,
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
      ru.user_id,
      u.email::text,
      COALESCE(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        u.raw_user_meta_data ->> 'nombre_completo',
        u.raw_user_meta_data ->> 'given_name'
      ),
      ru.rol,
      u.last_sign_in_at,
      COALESCE(ei.ingresos, 0),
      COALESCE(ei.vistas, 0)
    FROM roles_usuario ru
    JOIN auth.users u ON u.id = ru.user_id
    LEFT JOIN estadisticas_ingreso ei ON ei.user_id = ru.user_id
    ORDER BY u.email;
END;
$$;
