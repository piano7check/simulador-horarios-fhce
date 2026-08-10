-- ============================================
-- Enable RLS + public read-only policies
-- ============================================
-- Estas tablas nunca tuvieron RLS habilitado desde su creación
-- (20260212172916_scheme-creation.sql). Sin RLS, Postgres aplica los
-- permisos de rol por defecto de Supabase, que incluyen INSERT/UPDATE/DELETE
-- para los roles anon y authenticated — confirmado en vivo: la anon key
-- (pública, visible en el bundle JS del frontend) tiene permisos reales de
-- UPDATE y DELETE sobre `materias` vía la API REST autogenerada de PostgREST,
-- sin pasar por las funciones RPC de la app.
--
-- El contenido de estas tablas es información pública de horarios (no hay
-- riesgo de privacidad), pero sin esto cualquiera puede modificar o borrar
-- materias, grupos, clases, docentes, etc. de forma anónima.
--
-- Esta migración habilita RLS en las 8 tablas afectadas y agrega una
-- política de solo lectura (SELECT) pública. Al no agregar políticas de
-- INSERT/UPDATE/DELETE, esas operaciones quedan bloqueadas por defecto
-- para anon/authenticated, sin afectar la lectura pública de horarios ni
-- las funciones RPC (que corren como el dueño de la función, no se ven
-- afectadas por RLS salvo que sean SECURITY INVOKER explícito).

ALTER TABLE facultades ENABLE ROW LEVEL SECURITY;
ALTER TABLE niveles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestiones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE docentes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE carreras   ENABLE ROW LEVEL SECURITY;
ALTER TABLE materias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_facultades" ON facultades;
CREATE POLICY "public_read_facultades" ON facultades FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_niveles" ON niveles;
CREATE POLICY "public_read_niveles" ON niveles FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_gestiones" ON gestiones;
CREATE POLICY "public_read_gestiones" ON gestiones FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_docentes" ON docentes;
CREATE POLICY "public_read_docentes" ON docentes FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_carreras" ON carreras;
CREATE POLICY "public_read_carreras" ON carreras FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_materias" ON materias;
CREATE POLICY "public_read_materias" ON materias FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_grupos" ON grupos;
CREATE POLICY "public_read_grupos" ON grupos FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_clases" ON clases;
CREATE POLICY "public_read_clases" ON clases FOR SELECT USING (true);
