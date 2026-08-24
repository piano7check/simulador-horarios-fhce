-- ============================================
-- Aula virtual y grupo de WhatsApp por grupo + panel de administración
-- ============================================
-- Agrega dos campos opcionales por grupo (aula_virtual, whatsapp_grupo),
-- cargados a mano por un administrador. `grupos` ya tiene RLS habilitado
-- con solo lectura pública (ver 20260810000000_enable-rls-public-read.sql,
-- que documenta un incidente previo donde esta tabla quedó editable por
-- cualquiera con la anon key) — la escritura de estos campos se restringe
-- explícitamente a admins, nunca se abre escritura general.

ALTER TABLE grupos
  ADD COLUMN IF NOT EXISTS aula_virtual text,
  ADD COLUMN IF NOT EXISTS whatsapp_grupo text;

-- ============================================
-- 1) Tabla de admins
-- ============================================
-- Sin políticas propias: nadie puede leerla/escribirla directo vía la API
-- pública. Solo se consulta internamente desde is_admin() (SECURITY DEFINER).

CREATE TABLE IF NOT EXISTS admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2) is_admin(): helper interno, bypassa RLS de `admins` al ser
--    SECURITY DEFINER (corre con los privilegios del dueño de la función)
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

-- ============================================
-- 3) Política de UPDATE en `grupos`, restringida a admins
-- ============================================

DROP POLICY IF EXISTS "admins_update_grupos" ON grupos;
CREATE POLICY "admins_update_grupos" ON grupos
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- 4) soy_admin(): RPC pública para que el frontend pregunte "¿el usuario
--    actual es admin?" sin exponer la tabla `admins` directamente.
-- ============================================

CREATE OR REPLACE FUNCTION soy_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT is_admin();
$$;

-- ============================================
-- 5) obtener_clases_por_materia: se agregan aula_virtual y whatsapp_grupo
--    al resultado que ya consume el estudiante (mismo query base que
--    20260212185616_specific-gathering.sql).
-- ============================================

DROP FUNCTION IF EXISTS obtener_clases_por_materia(smallint, text);

CREATE FUNCTION obtener_clases_por_materia(
    p_materia_id smallint,
    p_gestion    text
)
RETURNS TABLE (
    grupo_numero    text,
    dia             dia_semana,
    docente         text,
    aula            text,
    hora_inicio     time,
    hora_fin        time,
    aula_virtual    text,
    whatsapp_grupo  text
)
LANGUAGE sql STABLE
AS $$
    SELECT g.numero    AS grupo_numero,
           cl.dia,
           d.nombre_completo AS docente,
           cl.aula,
           cl.hora_inicio,
           cl.hora_fin,
           g.aula_virtual,
           g.whatsapp_grupo
    FROM grupos g
    JOIN gestiones ge ON ge.id = g.gestion_id
    JOIN clases cl    ON cl.grupo_id = g.id
    JOIN docentes d   ON d.id = cl.docente_id
    WHERE g.materia_id = p_materia_id
      AND ge.periodo   = p_gestion
    ORDER BY g.numero,
             CASE cl.dia
                 WHEN 'Lunes'     THEN 1
                 WHEN 'Martes'    THEN 2
                 WHEN 'Miercoles' THEN 3
                 WHEN 'Jueves'    THEN 4
                 WHEN 'Viernes'   THEN 5
                 WHEN 'Sabado'    THEN 6
             END,
             cl.hora_inicio;
$$;

-- ============================================
-- 6) obtener_grupos_admin: lista los grupos de una materia con su id real
--    (que el estudiante nunca ve) para el panel de administración. Es de
--    solo lectura y `grupos` ya es públicamente legible, así que no
--    necesita is_admin() — la restricción de admin está en el UPDATE.
-- ============================================

CREATE OR REPLACE FUNCTION obtener_grupos_admin(
    p_materia_id smallint,
    p_gestion    text
)
RETURNS TABLE (
    id             smallint,
    numero         text,
    aula_virtual   text,
    whatsapp_grupo text
)
LANGUAGE sql STABLE
AS $$
    SELECT g.id, g.numero, g.aula_virtual, g.whatsapp_grupo
    FROM grupos g
    JOIN gestiones ge ON ge.id = g.gestion_id
    WHERE g.materia_id = p_materia_id
      AND ge.periodo   = p_gestion
    ORDER BY g.numero;
$$;
