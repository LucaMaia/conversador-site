-- =============================================================================
-- Storage: bucket privado com arquivos já cifrados no navegador.
-- Caminho dos objetos: {room_id}/{uuid}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 52428800, array['application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and private.can_access_room(private.try_uuid((storage.foldername(name))[1]))
  );

create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and private.can_access_room(private.try_uuid((storage.foldername(name))[1]))
    and array_length(storage.foldername(name), 1) = 1
  );

-- Sem políticas de update/delete: só a limpeza no servidor (service_role) remove.
