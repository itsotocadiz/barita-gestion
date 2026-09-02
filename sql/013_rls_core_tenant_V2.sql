-- 013_rls_core_tenant_V2.sql - Fix bug Super Admin no ve Terra - case-insensitive + paridad demo+terra
-- Reemplaza 013 V1 (get_my_role IN superadmin/admin) que ocultó terra cuando Escuela Activa = Terra pero usuarios.colegio_id = demo
alter table public.estudiantes enable row level security;
drop policy if exists "estudiantes_tenant" on public.estudiantes;
create policy "estudiantes_tenant" on public.estudiantes for all
using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio())
with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.funcionarios enable row level security;
drop policy if exists "funcionarios_tenant" on public.funcionarios;
create policy "funcionarios_tenant" on public.funcionarios for all
using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio())
with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.casos enable row level security;
drop policy if exists "casos_tenant" on public.casos;
create policy "casos_tenant" on public.casos for all
using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio())
with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.anotaciones enable row level security;
drop policy if exists "anotaciones_tenant" on public.anotaciones;
create policy "anotaciones_tenant" on public.anotaciones for all
using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id = public.get_my_colegio())
with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id = public.get_my_colegio());
-- atrasos/inasistencias/eventos/acciones igual
alter table public.atrasos enable row level security; drop policy if exists "atrasos_tenant" on public.atrasos;
create policy "atrasos_tenant" on public.atrasos for all using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio()) with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.inasistencias enable row level security; drop policy if exists "inasistencias_tenant" on public.inasistencias;
create policy "inasistencias_tenant" on public.inasistencias for all using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio()) with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.eventos enable row level security; drop policy if exists "eventos_tenant" on public.eventos;
create policy "eventos_tenant" on public.eventos for all using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio()) with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
alter table public.acciones enable row level security; drop policy if exists "acciones_tenant" on public.acciones;
create policy "acciones_tenant" on public.acciones for all using (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio()) with check (LOWER(TRIM(public.get_my_role()))='superadmin' OR colegio_id::text = public.get_my_colegio());
REVOKE ALL ON public.estudiantes, public.casos, public.anotaciones, public.atrasos, public.inasistencias, public.eventos, public.acciones, public.funcionarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudiantes, public.casos, public.anotaciones, public.atrasos, public.inasistencias, public.eventos, public.acciones, public.funcionarios TO authenticated;
NOTIFY pgrst, 'reload schema';
