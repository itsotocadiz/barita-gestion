-- ================================================================
-- 010_casos_lirmi_dual_CORREGIDO.sql - BARITA Gestion
-- Dual Manual + Excel LIRMI para Casos (sin API, sin asistencia)
-- Vinculación evidencia: caso_anotaciones (anónima, sin apoderados)
-- Proyecto: gwhlgphmchnymsiwqpkx (GESTION AISLADO - no ejecutar en jmjyaakrliahbkekuceo)
-- Fix 42804: caso_id UUID vs casos.id TEXT -> usar TEXT
-- Ejecutar en Supabase SQL Editor gwhlgphmchnymsiwqpkx - Idempotente - Seguro re-ejecutar
-- ================================================================
-- PRE-CHECKS (ejecutar antes, solo lectura):
-- SELECT column_name, data_type, udt_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='casos' AND column_name='id';
-- -- Esperado gestion: text (no uuid). Si ves uuid, usa variante UUID abajo.
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='anotaciones' AND column_name='id';
-- -- Esperado gestion: text (Storage.generateId() -> TEXT). Si es uuid, ajusta anotacion_id a UUID.

-- 0. Guardrail: abortar si se ejecuta en proyecto postulaciones (jmjya.../tujhxt...)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='postulantes')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vacantes')
  THEN
    RAISE EXCEPTION 'ABORTADO: Este script es solo para gestion gwhlgphmchnymsiwqpkx. Detectadas tablas postulantes/vacantes de talento. Cambia de proyecto Supabase.';
  END IF;
END $$;

-- 1. Casos: añadir columnas para trazabilidad dual y semáforo origen (idempotente)
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS anio INT CHECK (anio BETWEEN 2020 AND 2035);
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS semaforo_origen TEXT CHECK (semaforo_origen IN ('verde','amarillo','rojo'));
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS protocolo_checklist_id TEXT;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS evidencia_origen TEXT DEFAULT 'manual' CHECK (evidencia_origen IN ('manual','lirmi_excel','lirmi_api'));
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS proximo_seguimiento DATE;
-- Backfill anio desde fecha (tolerante a fecha TEXT o TIMESTAMPTZ)
DO $$ BEGIN
  BEGIN
    UPDATE public.casos SET anio = EXTRACT(YEAR FROM fecha::timestamptz)::int WHERE anio IS NULL AND fecha IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- fallback si fecha es TEXT no casteable, intenta substring
    UPDATE public.casos SET anio = substring(fecha from 1 for 4)::int WHERE anio IS NULL AND fecha IS NOT NULL AND fecha ~ '^[0-9]{4}';
  END;
END $$;
UPDATE public.casos SET anio = EXTRACT(YEAR FROM now())::int WHERE anio IS NULL;

-- 2. Tabla puente caso <-> anotacion (clave dual) - CORREGIDO TIPO TEXT
-- Fix 42804: casos.id es TEXT (ger-gestion) -> caso_id debe ser TEXT, no UUID.
-- Igual para anotaciones.id que es TEXT en gestion (generateId string).
-- Si tu instancia tiene anotaciones.id UUID, cambia anotacion_id a UUID (ver nota abajo).
CREATE TABLE IF NOT EXISTS public.caso_anotaciones (
  caso_id TEXT NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  anotacion_id TEXT NOT NULL REFERENCES public.anotaciones(id) ON DELETE CASCADE,
  colegio_id TEXT NOT NULL,
  vinculado_por UUID,
  vinculado_at TIMESTAMPTZ DEFAULT now(),
  origen TEXT DEFAULT 'manual' CHECK (origen IN ('manual','lirmi_excel')),
  PRIMARY KEY (caso_id, anotacion_id)
);

-- Migración si tabla ya existe con tipo UUID (creada por 010 fallido a medias)
DO $$ BEGIN
  -- Si columna existe como uuid, convertir a TEXT sin perder datos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='caso_anotaciones'
      AND column_name='caso_id' AND data_type='uuid'
  ) THEN
    -- drop FKs dependientes antes de alterar tipo
    BEGIN
      ALTER TABLE public.caso_anotaciones DROP CONSTRAINT IF EXISTS caso_anotaciones_caso_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER TABLE public.caso_anotaciones ALTER COLUMN caso_id TYPE TEXT USING caso_id::text;
    -- recrear FK a casos(id) TEXT
    BEGIN
      ALTER TABLE public.caso_anotaciones ADD CONSTRAINT caso_anotaciones_caso_id_fkey
        FOREIGN KEY (caso_id) REFERENCES public.casos(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='caso_anotaciones'
      AND column_name='anotacion_id' AND data_type='uuid'
  ) THEN
    BEGIN
      ALTER TABLE public.caso_anotaciones DROP CONSTRAINT IF EXISTS caso_anotaciones_anotacion_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    ALTER TABLE public.caso_anotaciones ALTER COLUMN anotacion_id TYPE TEXT USING anotacion_id::text;
    BEGIN
      ALTER TABLE public.caso_anotaciones ADD CONSTRAINT caso_anotaciones_anotacion_id_fkey
        FOREIGN KEY (anotacion_id) REFERENCES public.anotaciones(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_caso ON public.caso_anotaciones(caso_id);
CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_anotacion ON public.caso_anotaciones(anotacion_id);
CREATE INDEX IF NOT EXISTS idx_caso_anotaciones_colegio ON public.caso_anotaciones(colegio_id);

-- 3. RLS tenant (idempotente) - mismo patrón que 012_dotacion_anual
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

-- 5. Comentarios
COMMENT ON TABLE public.caso_anotaciones IS 'BARITA dual: vincula anotaciones (manual o importadas de LIRMI Excel) a casos. No guarda asistencia diaria ni comunica a apoderados. FK TEXT alineado a casos.id TEXT (fix 42804).';
COMMENT ON COLUMN public.casos.evidencia_origen IS 'manual=creado en BARITA, lirmi_excel=evidencia importada de Excel LIRMI, lirmi_api=futuro API';
COMMENT ON COLUMN public.caso_anotaciones.caso_id IS 'FK TEXT -> casos.id TEXT (gestion). No UUID para evitar 42804.';
COMMENT ON COLUMN public.caso_anotaciones.anotacion_id IS 'FK TEXT -> anotaciones.id TEXT (gestion). Si tu anotaciones.id es UUID, altera esta columna a UUID.';

-- 6. Verificación post-ejecución (ejecutar manual)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='caso_anotaciones' ORDER BY ordinal_position;
-- Esperado: caso_id=text, anotacion_id=text, colegio_id=text, vinculado_por=uuid
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='caso_anotaciones';
-- SELECT * FROM pg_policies WHERE tablename='caso_anotaciones';
