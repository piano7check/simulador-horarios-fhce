-- ============================================
-- Corrige overload duplicado de obtener_clases_por_materia
-- ============================================
-- Tras 20260824024148_grupo-extras-y-admins.sql quedaron dos versiones
-- de esta función en la base (una con p_materia_id smallint y otra con
-- integer), y PostgREST no puede elegir cuál usar al llamarla desde el
-- frontend ("Could not choose the best candidate function..."), rompiendo
-- por completo la carga de clases para el estudiante.
--
-- Se borran TODAS las versiones existentes de la función (sin importar el
-- tipo exacto del parámetro, para no depender de adivinar cuál quedó) y se
-- vuelve a crear una única versión correcta.

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
