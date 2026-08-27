-- ============================================
-- Foto y descripción por docente
-- ============================================
-- Se agrega una pestaña "Docentes" al panel de administración para que
-- cualquier rol de staff (auxiliar, docente o administrador -- mismo
-- criterio que ya usa "Aula virtual y WhatsApp") pueda cargar una foto
-- y una descripción breve de cada docente.
--
-- `docentes` ya es de lectura pública (public_read_docentes, ver
-- 20260810000000_enable-rls-public-read.sql); se agrega una política de
-- UPDATE igual de restringida que la de `grupos` (staff_update_grupos),
-- reusando la misma función puede_editar_grupos() -- a pesar del
-- nombre, solo comprueba "es alguien de staff", no tiene nada
-- específico de grupos.

ALTER TABLE docentes
  ADD COLUMN foto_url text,
  ADD COLUMN descripcion text;

CREATE POLICY "staff_update_docentes" ON docentes
  FOR UPDATE
  USING (puede_editar_grupos())
  WITH CHECK (puede_editar_grupos());
