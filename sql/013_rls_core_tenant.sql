-- 013_rls_core_tenant.sql - RLS tenant estricto core NNA - Venta LIRMI
-- Aplica a TODOS los colegios (demo + terra_di_bimbi) - Idempotente - Requiere 05 get_my_colegio()
-- Cierra USING (true) y GRANT anon abiertos en 02 schema_gestion.sql

-- Estudiantes / Casos ya tienen tenant en 08_verificacion, los reforzamos
alter table public.estudiantes enable row level security;
drop policy if exists "estudiantes_tenant" on public.estudiantes;
create policy "estudiantes_tenant" on public.estudiantes for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.casos enable row level security;
drop policy if exists "casos_tenant" on public.casos;
create policy "casos_tenant" on public.casos for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

-- Anotaciones / Atrasos / Inasistencias / Eventos / Acciones / Funcionarios
alter table public.anotaciones enable row level security;
drop policy if exists "anotaciones_tenant" on public.anotaciones;
create policy "anotaciones_tenant" on public.anotaciones for all
using (colegio_id = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.atrasos enable row level security;
drop policy if exists "atrasos_tenant" on public.atrasos;
create policy "atrasos_tenant" on public.atrasos for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.inasistencias enable row level security;
drop policy if exists "inasistencias_tenant" on public.inasistencias;
create policy "inasistencias_tenant" on public.inasistencias for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.eventos enable row level security;
drop policy if exists "eventos_tenant" on public.eventos;
create policy "eventos_tenant" on public.eventos for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.acciones enable row level security;
drop policy if exists "acciones_tenant" on public.acciones;
create policy "acciones_tenant" on public.acciones for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

alter table public.funcionarios enable row level security;
drop policy if exists "funcionarios_tenant" on public.funcionarios;
create policy "funcionarios_tenant" on public.funcionarios for all
using (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'))
with check (colegio_id::text = public.get_my_colegio() or public.get_my_role() IN ('superadmin','admin'));

-- Cerrar anon
REVOKE ALL ON public.estudiantes, public.casos, public.anotaciones, public.atrasos, public.inasistencias, public.eventos, public.acciones, public.funcionarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudiantes, public.casos, public.anotaciones, public.atrasos, public.inasistencias, public.eventos, public.acciones, public.funcionarios TO authenticated;

NOTIFY pgrst, 'reload schema';
