-- ============================================
-- obtener_docentes_por_carrera: para buscar materias por docente en el
-- panel de administración (igual que ya se puede buscar por docente al
-- agregar materias en el planificador de estudiante).
-- ============================================
-- Devuelve, para cada materia de una carrera/gestión, sus docentes
-- distintos. Es de solo lectura y `grupos`/`clases`/`docentes` ya son
-- públicamente legibles, así que no necesita restricción de admin.

CREATE FUNCTION obtener_docentes_por_carrera(
    p_carrera_id smallint,
    p_gestion    text
)
RETURNS TABLE (
    materia_id smallint,
    docente    text
)
LANGUAGE sql STABLE
AS $$
    SELECT DISTINCT m.id AS materia_id, d.nombre_completo AS docente
    FROM materias m
    JOIN grupos g     ON g.materia_id = m.id
    JOIN gestiones ge ON ge.id = g.gestion_id
    JOIN clases cl    ON cl.grupo_id = g.id
    JOIN docentes d   ON d.id = cl.docente_id
    WHERE m.carrera_id = p_carrera_id
      AND ge.periodo   = p_gestion;
$$;
