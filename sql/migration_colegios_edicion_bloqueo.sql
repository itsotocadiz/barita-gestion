-- ================================================================
-- migration_colegios_edicion_bloqueo.sql - BARITA Gestion
-- Agrega logo, RBD unico, director/contacto y bloqueo por suscripcion
-- Ejecutar en Supabase SQL Editor para proyecto gwhlgphmchnymsiwqpkx
-- Idempotente: seguro re-ejecutar
-- ================================================================

-- 1. Crear tabla si no existe (compat superadmin.js:533)
CREATE TABLE IF NOT EXISTS public.colegios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  rbd VARCHAR(10),
  contacto TEXT,
  suscripcion TEXT DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Agregar nuevas columnas
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS director_nombre TEXT;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS director_contacto TEXT;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS estado_suscripcion TEXT DEFAULT 'activa';
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS fecha_bloqueo TIMESTAMPTZ;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS bloqueado_por UUID;
ALTER TABLE public.colegios ADD COLUMN IF NOT EXISTS bloqueado_at TIMESTAMPTZ;

-- 3. Migrar datos legacy suscripcion -> estado_suscripcion
UPDATE public.colegios SET estado_suscripcion = CASE WHEN suscripcion='suspendida' THEN 'bloqueado' ELSE 'activa' END WHERE estado_suscripcion IS NULL OR estado_suscripcion = '';

-- 4. Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_colegios_rbd_format') THEN
    ALTER TABLE public.colegios ADD CONSTRAINT chk_colegios_rbd_format CHECK (rbd IS NULL OR rbd ~ '^[0-9]{1,5}-[0-9Kk]$');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_colegios_estado') THEN
    ALTER TABLE public.colegios ADD CONSTRAINT chk_colegios_estado CHECK (estado_suscripcion IN ('activo','bloqueado','activa','suspendida'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_colegios_logo_url') THEN
    ALTER TABLE public.colegios ADD CONSTRAINT chk_colegios_logo_url CHECK (logo_url IS NULL OR logo_url ~ '^https?://' OR logo_url ~ '^data:image/');
  END IF;
END $$;

-- 5. Indices
CREATE UNIQUE INDEX IF NOT EXISTS idx_colegios_rbd_unique ON public.colegios(rbd) WHERE rbd IS NOT NULL AND rbd <> '';
CREATE INDEX IF NOT EXISTS idx_colegios_estado ON public.colegios(estado_suscripcion);

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $func$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $func$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_colegios_updated ON public.colegios;
CREATE TRIGGER trg_colegios_updated BEFORE UPDATE ON public.colegios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. RLS (si no existe)
ALTER TABLE public.colegios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colegios_select_all" ON public.colegios;
CREATE POLICY "colegios_select_all" ON public.colegios FOR SELECT USING (true);
DROP POLICY IF EXISTS "colegios_write_superadmin" ON public.colegios;
CREATE POLICY "colegios_write_superadmin" ON public.colegios FOR ALL USING ((auth.jwt()->>'role')='superadmin') WITH CHECK ((auth.jwt()->>'role')='superadmin');

-- 8. Tabla auditoria bloqueo (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS public.auditoria_colegios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colegio_id TEXT REFERENCES public.colegios(id) ON DELETE CASCADE,
  accion TEXT NOT NULL,
  por UUID,
  detalle JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.auditoria_colegios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auditoria_select_superadmin" ON public.auditoria_colegios;
CREATE POLICY "auditoria_select_superadmin" ON public.auditoria_colegios FOR SELECT USING ((auth.jwt()->>'role')='superadmin');
DROP POLICY IF EXISTS "auditoria_insert_superadmin" ON public.auditoria_colegios;
CREATE POLICY "auditoria_insert_superadmin" ON public.auditoria_colegios FOR INSERT WITH CHECK ((auth.jwt()->>'role')='superadmin');

-- 9. Datos de prueba sin RUT reales (solo si faltan)
INSERT INTO public.colegios (id, nombre, rbd, director_nombre, director_contacto, estado_suscripcion, logo_url)
VALUES ('demo','Escuela DEMO','RBD-001','Directora Demo','demo@barita.test','activo', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.colegios (id, nombre, rbd, director_nombre, director_contacto, estado_suscripcion, logo_url)
VALUES ('terra_di_bimbi','Escuela TERRA DI BIMBI','RBD-002','Direccion Terra','contacto@terradibimbi.cl','activo', NULL)
ON CONFLICT (id) DO NOTHING;
