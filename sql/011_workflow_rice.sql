-- ================================================================
-- 011_workflow_rice.sql - BARITA Gestion
-- Workflow RICE 26 protocolos + máquina estados Caso
-- Aplica a TODOS los colegios (demo + terra_di_bimbi) - Idempotente
-- No asistencia, sin API LIRMI, dual manual+Excel intacto
-- ================================================================

-- 1. Ampliar check estadosCaso para workflow completo
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='casos_estado_check') THEN
    ALTER TABLE public.casos DROP CONSTRAINT casos_estado_check;
  END IF;
END $$;
ALTER TABLE public.casos ADD CONSTRAINT casos_estado_check CHECK (estado IN ('denuncia','investigacion','medida','seguimiento','cerrado','abierto','en_proceso'));

-- 2. Asegurar columnas workflow (ya creadas en 010, reconfirmar)
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS anio INT CHECK (anio BETWEEN 2020 AND 2035);
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS semaforo_origen TEXT CHECK (semaforo_origen IN ('verde','amarillo','rojo'));
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS protocolo_checklist_id TEXT;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS evidencia_origen TEXT DEFAULT 'manual' CHECK (evidencia_origen IN ('manual','lirmi_excel','lirmi_api'));
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS plazo_dias INT DEFAULT 10;
ALTER TABLE public.casos ADD COLUMN IF NOT EXISTS responsable TEXT;

-- 3. Backfill workflow para casos legacy abierto/en_proceso
UPDATE public.casos SET estado='denuncia' WHERE estado='abierto';
UPDATE public.casos SET estado='seguimiento' WHERE estado='en_proceso';

-- 4. Comentarios paridad
COMMENT ON COLUMN public.casos.estado IS 'Workflow RICE: denuncia->investigacion(10d)->medida->seguimiento(15/30d)->cerrado. Paridad demo+terra_di_bimbi.';
