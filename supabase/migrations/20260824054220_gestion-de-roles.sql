-- ============================================
-- Gestión de roles: solo administrador puede asignar/cambiar/quitar
-- ============================================
-- Hasta ahora, dar o quitar un rol (auxiliar/docente/administrador) se
-- hacía a mano contra la base con la service role key. Se agregan
-- funciones para hacerlo desde la app, restringidas a quien ya sea
-- administrador. `auth.users` no está expuesta por la API pública, así
-- que estas funciones son SECURITY DEFINER (bypassan esa restricción
-- puntualmente, ya con el chequeo de autorización adentro) en vez de
-- políticas RLS normales.

-- ============================================
-- 1) es_administrador(): distingue administrador de auxiliar/docente,
--    para todo lo que sea exclusivo de ese rol (como esto).
-- ============================================

CREATE OR REPLACE FUNCTION es_administrador()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM roles_usuario WHERE user_id = auth.uid() AND rol = 'administrador'
  );
$$;

-- ============================================
-- 2) buscar_usuario_por_email(): para encontrar el user_id de una cuenta
--    ya registrada a partir de su correo (el admin no tiene forma de
--    saber el UUID de memoria).
-- ============================================

CREATE OR REPLACE FUNCTION buscar_usuario_por_email(p_email text)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;
END;
$$;

-- ============================================
-- 3) listar_roles_usuario(): quién tiene qué rol hoy, con su correo.
-- ============================================

CREATE OR REPLACE FUNCTION listar_roles_usuario()
RETURNS TABLE (user_id uuid, email text, rol rol_usuario)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
    SELECT ru.user_id, u.email::text, ru.rol
    FROM roles_usuario ru
    JOIN auth.users u ON u.id = ru.user_id
    ORDER BY u.email;
END;
$$;

-- ============================================
-- 4) asignar_rol() / quitar_rol(): dar, cambiar o quitar un rol.
-- ============================================

CREATE OR REPLACE FUNCTION asignar_rol(p_user_id uuid, p_rol rol_usuario)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO roles_usuario (user_id, rol)
  VALUES (p_user_id, p_rol)
  ON CONFLICT (user_id) DO UPDATE SET rol = EXCLUDED.rol;
END;
$$;

CREATE OR REPLACE FUNCTION quitar_rol(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT es_administrador() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM roles_usuario WHERE user_id = p_user_id;
END;
$$;
