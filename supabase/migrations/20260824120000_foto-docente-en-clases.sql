-- ============================================
-- obtener_clases_por_materia: agrega la foto del docente
-- ============================================
-- Ahora que un docente puede tener una foto cargada (ver
-- 20260824100000_foto-y-descripcion-docentes.sql), se agrega al
-- resultado que ya consume el modal de detalle de clase del estudiante,
-- para mostrarla junto al nombre.
--
-- Se borran todas las versiones existentes (via pg_proc, mismo patrón
-- que las migraciones anteriores que tocaron esta función) para no
-- repetir el bug de overloads duplicados.

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
    docente_foto_url  text,
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
           d.foto_url  AS docente_foto_url,
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
