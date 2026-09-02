-- ================================================================
-- 012_dotacion_anual.sql - BARITA Gestion
-- Continuidad laboral docente 2025->2026 + Sala Gestión
-- Aplica a TODOS los colegios (demo + terra_di_bimbi) - Idempotente
-- ================================================================

CREATE TABLE IF NOT EXISTS public.dotacion_anual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colegio_id TEXT NOT NULL REFERENCES public.colegios(id) ON DELETE CASCADE,
  funcionario_id TEXT NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  anio INT NOT NULL CHECK (anio BETWEEN 2020 AND 2035),
  cargo TEXT,
  horas INT CHECK (horas BETWEEN 1 AND 44),
  tipo_contrato TEXT CHECK (tipo_contrato IN ('indefinido','plazo','reemplazo','honorarios')),
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','licencia','permiso','inactivo','trasladado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(colegio_id, funcionario_id, anio)
);
CREATE INDEX IF NOT EXISTS idx_dotacion_colegio_anio ON public.dotacion_anual(colegio_id, anio);
CREATE INDEX IF NOT EXISTS idx_dotacion_funcionario ON public.dotacion_anual(funcionario_id);

ALTER TABLE public.dotacion_anual ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dotacion_tenant" ON public.dotacion_anual;
CREATE POLICY "dotacion_tenant" ON public.dotacion_anual FOR ALL
  USING (colegio_id = (auth.jwt()->>'colegio_id') OR (auth.jwt()->>'role')='superadmin')
  WITH CHECK (colegio_id = (auth.jwt()->>'colegio_id') OR (auth.jwt()->>'role')='superadmin');
REVOKE ALL ON public.dotacion_anual FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dotacion_anual TO authenticated;

COMMENT ON TABLE public.dotacion_anual IS 'Continuidad laboral: foto anual por docente. Misma estructura demo y terra_di_bimbi. No pierde historial si demo se borra.';
