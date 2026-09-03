-- 014_storage_objects_rls.sql - Storage buckets RLS tenant - Best of Best 3A
-- Aplica a storage.objects para pdf_hoja_vida / documentos - paridad demo+terra
-- Requiere que buckets 'barita-docs' y 'barita-attachments' existan (crear en Supabase Storage si no existen)
-- Idempotente
create extension if not exists "uuid-ossp";
-- Buckets (si no existen, crear manualmente en Dashboard -> Storage -> New bucket)
-- insert into storage.buckets (id, name, public) values ('barita-docs','barita-docs', false) on conflict (id) do nothing;
-- insert into storage.buckets (id, name, public) values ('barita-attachments','barita-attachments', false) on conflict (id) do nothing;

-- RLS tenant para storage.objects (colegio_id en metadata o owner)
-- Nota: storage.objects no tiene colegio_id nativo, usamos owner (auth.uid) + usuarios.colegio_id
alter table storage.objects enable row level security;
drop policy if exists "storage_tenant_select" on storage.objects;
create policy "storage_tenant_select" on storage.objects for select
using (bucket_id in ('barita-docs','barita-attachments') and (LOWER(TRIM(public.get_my_role()))='superadmin' or owner = auth.uid()));
drop policy if exists "storage_tenant_insert" on storage.objects;
create policy "storage_tenant_insert" on storage.objects for insert
with check (bucket_id in ('barita-docs','barita-attachments') and auth.uid() is not null);
drop policy if exists "storage_tenant_update" on storage.objects;
create policy "storage_tenant_update" on storage.objects for update
using (owner = auth.uid() or LOWER(TRIM(public.get_my_role()))='superadmin');
drop policy if exists "storage_tenant_delete" on storage.objects;
create policy "storage_tenant_delete" on storage.objects for delete
using (owner = auth.uid() or LOWER(TRIM(public.get_my_role()))='superadmin');
