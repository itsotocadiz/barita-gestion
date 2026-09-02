-- ================================================================
-- 010_casos_lirmi_dual.sql - BARITA Gestion
-- Dual Manual + Excel LIRMI para Casos (sin API, sin asistencia)
-- Vinculación evidencia: caso_anotaciones (anonima, sin apoderados)
-- Ejecutar en Supabase SQL Editor gwhlgphmchnymsiwqpkx - Idempotente
-- ================================================================

-- 1. Casos: añadir columnas para trazabilidad dual y semáforo origen
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS anio INT CHECK (anio BETWEEN 2020 AND 2035);
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS semaforo_origen TEXT CHECK (semaforo_origen IN ('verde','amarillo','rojo'));
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS protocolo_checklist_id TEXT;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS evidencia_origen TEXT DEFAULT 'manual' CHECK (evidencia_origen IN ('manual','lirmi_excel','lirmi_api'));
UPDATE public.casos SET anio = EXTRACT(YEAR FROM fecha::timestamptz)::int WHERE anio IS NULL AND fecha IS NOT NULL;
UPDATE public.casos SET anio = EXTRACT(YEAR FROM now())::int WHERE anio IS NULL;

-- 2. Tabla puente caso <-> anotacion (clave dual)
CREATE TABLE IF NOT EXISTS public.caso_anotaciones (
  caso_id UUID NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  anotacion_id UUID NOT NULL REFERENCES public.anotaciones(id) ON DELETE CASCADE,
  colegio_id TEXT NOT NULL,
  vinculado_por UUID,
  vinculado_at TIMESTAMPTZ DEFAULT now(),
  origen TEXT DEFAULT 'manual' CHECK (origen IN ('manual','lirmi_excel')),
  PRIMARY KEY (caso_id, anotacion_id)
);
CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_caso ON public.caso_anotaciones(caso_id);
CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_anotacion ON public.caso_anotaciones(anotacion_id);
CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_colegio ON public.caso_anotaciones(colegio_id);

-- 3. RLS tenant
ALTER TABLE public.caso_anotaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caso_anotaciones_tenant" ON public.caso_anotaciones;
CREATE POLICY "caso_anotaciones_tenant" ON public.caso_anotaciones FOR ALL
  USING (colegio_id = (auth.jwt()->>'colegio_id') OR (auth.jwt()->>'role')='superadmin')
  WITH CHECK (colegio_id = (auth.jwt()->>'colegio_id') OR (auth.jwt()->>'role')='superadmin');
REVOKE ALL ON public.caso_anotaciones FROM anon;
GRANT SELECT, INSERT, DELETE ON public.caso_anotaciones TO authenticated;

-- 4. Índices casos para dashboard priorizado
CREATE INDEX IF NOT EXISTS idx_casos_colegio_anio_estado ON public.casos(colegio_id, anio, estado);
CREATE INDEX IF NOT EXISTS idx_casos_semaforo ON public.casos(colegio_id, semaforo_origen) WHERE semaforo_origen IS NOT NULL;

-- 5. Seguimientos: asegurar fecha_proximo para alertas dashboard
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS proximo_seguimiento DATE;
-- Compat: si existe casos.seguimiento JSONB, no tocar; nueva tabla seguimientos ya existe en storage logic

-- 6. Comentarios
COMMENT ON TABLE public.caso_anotaciones IS 'BARITA dual: vincula anotaciones (manual o importadas de LIRMI Excel) a casos. No guarda asistencia diaria ni comunica a apoderados.';
COMMENT ON COLUMN public.casos.evidencia_origen IS 'manual=creado en BARITA, lirmi_excel=evidencia importada de Excel LIRMI, lirmi_api=futuro API';
