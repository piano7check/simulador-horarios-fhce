-- ============================================
-- Bucket de Storage para fotos de docentes
-- ============================================
-- Hasta ahora "Foto" en la pestaña Docentes era un link a una imagen ya
-- alojada en otro lado (Drive, imgur, etc.). Se agrega un bucket propio
-- para poder subir el archivo directo desde el panel de administración,
-- en vez de depender de un link externo.
--
-- Público de lectura (los estudiantes ven la foto sin sesión, igual que
-- ya pueden leer aula_virtual/whatsapp_docente), pero solo un rol de
-- staff puede subir/reemplazar/borrar -- mismo criterio que el resto de
-- este módulo (puede_editar_grupos()).

INSERT INTO storage.buckets (id, name, public)
VALUES ('docentes-fotos', 'docentes-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_docentes_fotos" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'docentes-fotos');

CREATE POLICY "staff_insert_docentes_fotos" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'docentes-fotos' AND puede_editar_grupos());

CREATE POLICY "staff_update_docentes_fotos" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'docentes-fotos' AND puede_editar_grupos())
  WITH CHECK (bucket_id = 'docentes-fotos' AND puede_editar_grupos());

CREATE POLICY "staff_delete_docentes_fotos" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'docentes-fotos' AND puede_editar_grupos());
