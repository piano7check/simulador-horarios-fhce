-- ============================================
-- Reemplaza el esquema simple de "admin sí/no" por roles de staff
-- ============================================
-- La migración anterior (20260824024148_grupo-extras-y-admins.sql) creó
-- una tabla `admins` binaria, pero se necesitan tres roles distintos:
--   - auxiliar:      puede cargar aula virtual / grupo de WhatsApp
--   - docente:       por ahora hace lo mismo, pensado para más adelante
--                     poder restringirlo a solo sus propias materias
--   - administrador: por ahora hace lo mismo, más adelante va a tener
--                     permisos adicionales de control del sistema
-- La tabla `admins` nunca se llegó a usar (0 filas, todavía no se había
-- hecho el bootstrap del primer admin), así que es seguro reemplazarla
-- sin perder datos.

DROP POLICY IF EXISTS "admins_update_grupos" ON grupos;
DROP FUNCTION IF EXISTS soy_admin();
DROP FUNCTION IF EXISTS is_admin();
DROP TABLE IF EXISTS admins;

-- ============================================
-- 1) Rol de cada usuario de staff (estudiante = no tiene fila acá)
-- ============================================
-- Sin políticas propias: nadie puede leerla/escribirla directo vía la API
-- pública. Solo se consulta internamente desde funciones SECURITY DEFINER.

CREATE TYPE rol_usuario AS ENUM ('auxiliar', 'docente', 'administrador');

CREATE TABLE roles_usuario (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol     rol_usuario NOT NULL
);

ALTER TABLE roles_usuario ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2) puede_editar_grupos(): true para cualquier rol de staff (auxiliar,
--    docente o administrador). Es lo único que se necesita hoy para la
--    política de UPDATE en `grupos` — cuando algún rol tenga permisos
--    extra o restringidos, esas políticas nuevas van a chequear el rol
--    puntual en vez de esta función.
-- ============================================

CREATE OR REPLACE FUNCTION puede_editar_grupos()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM roles_usuario WHERE user_id = auth.uid());
$$;

CREATE POLICY "staff_update_grupos" ON grupos
  FOR UPDATE
  USING (puede_editar_grupos())
  WITH CHECK (puede_editar_grupos());

-- ============================================
-- 3) mi_rol(): RPC pública para que el frontend sepa el rol del usuario
--    actual ('auxiliar' | 'docente' | 'administrador' | null si es
--    estudiante), sin exponer la tabla `roles_usuario` directamente.
-- ============================================

CREATE OR REPLACE FUNCTION mi_rol()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT rol::text FROM roles_usuario WHERE user_id = auth.uid();
$$;
