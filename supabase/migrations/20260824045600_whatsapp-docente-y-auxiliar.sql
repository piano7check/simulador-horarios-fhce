-- ============================================
-- Separar el grupo de WhatsApp del docente y del auxiliar
-- ============================================
-- Antes había un solo campo `whatsapp_grupo` por grupo. Se renombra a
-- `whatsapp_docente` (conserva los datos ya cargados) y se agrega
-- `whatsapp_auxiliar`, para poder guardar los dos por separado.

ALTER TABLE grupos RENAME COLUMN whatsapp_grupo TO whatsapp_docente;
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS whatsapp_auxiliar text;

-- ============================================
-- obtener_clases_por_materia: agrega whatsapp_auxiliar y renombra
-- whatsapp_grupo -> whatsapp_docente en el resultado.
-- Se borran todas las versiones existentes (via pg_proc, como en
-- 20260824040211_fix-duplicado-obtener-clases.sql) para no repetir el
-- bug de overloads duplicados de la vez pasada.
-- ============================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'obtener_clases_por_materia'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE FUNCTION obtener_clases_por_materia(
    p_materia_id smallint,
    p_gestion    text
)
RETURNS TABLE (
    grupo_numero      text,
    dia               dia_semana,
    docente           text,
    aula              text,
    hora_inicio       time,
    hora_fin          time,
    aula_virtual      text,
    whatsapp_docente  text,
    whatsapp_auxiliar text
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
           g.whatsapp_docente,
           g.whatsapp_auxiliar
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
-- obtener_grupos_admin: mismo cambio para el panel de administración.
-- ============================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'obtener_grupos_admin'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

CREATE FUNCTION obtener_grupos_admin(
    p_materia_id smallint,
    p_gestion    text
)
RETURNS TABLE (
    id                smallint,
    numero            text,
    aula_virtual      text,
    whatsapp_docente  text,
    whatsapp_auxiliar text
)
LANGUAGE sql STABLE
AS $$
    SELECT g.id, g.numero, g.aula_virtual, g.whatsapp_docente, g.whatsapp_auxiliar
    FROM grupos g
    JOIN gestiones ge ON ge.id = g.gestion_id
    WHERE g.materia_id = p_materia_id
      AND ge.periodo   = p_gestion
    ORDER BY g.numero;
$$;
