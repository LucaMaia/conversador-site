-- =============================================================================
-- 1) Mensagens não lidas no painel do admin
-- 2) Imagens temporárias: somem 15 minutos depois de vistas pelo destinatário
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Não lidas
-- -----------------------------------------------------------------------------
alter table public.rooms
  add column admin_last_read_at timestamptz not null default now();

-- Atividade de todas as salas ativas: não lidas (do convidado) e última mensagem.
create function public.admin_room_activity()
returns table (room_id uuid, unread integer, last_message_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         count(m.id) filter (where m.sender_role = 'guest' and m.created_at > r.admin_last_read_at)::integer,
         max(m.created_at)
  from public.rooms r
  left join public.messages m on m.room_id = r.id
  where private.is_admin() and r.status = 'active'
  group by r.id;
$$;

-- Marca a sala como lida (horário do servidor).
create function public.mark_room_read(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'mark_room_read: acesso negado' using errcode = '42501';
  end if;
  update public.rooms set admin_last_read_at = now() where id = p_room_id and status = 'active';
end;
$$;

revoke all on function public.admin_room_activity() from public, anon;
revoke all on function public.mark_room_read(uuid) from public, anon;
grant execute on function public.admin_room_activity() to authenticated;
grant execute on function public.mark_room_read(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Mídia temporária
-- media_viewed_at  = primeira abertura pelo destinatário (definida pelo servidor)
-- media_expires_at = media_viewed_at + 15 min; depois disso o arquivo é bloqueado
-- media_purged     = arquivo já removido do Storage
-- -----------------------------------------------------------------------------
alter table public.messages
  add column media_viewed_at  timestamptz,
  add column media_expires_at timestamptz,
  add column media_purged     boolean not null default false;

create index messages_media_expiry_idx on public.messages (media_expires_at)
  where attachment_path is not null and not media_purged;

grant select (media_viewed_at, media_expires_at, media_purged) on public.messages to authenticated;

-- O arquivo pode ser lido enquanto a mensagem que o referencia não tiver
-- expirado. Usado pela política do Storage.
create function private.media_accessible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.messages m
    where m.attachment_path = p_name
      and (m.media_purged or (m.media_expires_at is not null and m.media_expires_at <= now()))
  );
$$;

revoke all on function private.media_accessible(text) from public;
grant execute on function private.media_accessible(text) to authenticated;

drop policy attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and private.can_access_room(private.try_uuid((storage.foldername(name))[1]))
    and private.media_accessible(name)
  );

-- Registra a primeira visualização pelo DESTINATÁRIO e inicia os 15 minutos.
-- Quem enviou pode ver a própria imagem sem iniciar a contagem.
-- Retorna o horário de expiração (null = ainda não iniciada, ou seja, remetente).
create function public.mark_media_viewed(p_message_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg       public.messages%rowtype;
  v_my_role   text;
begin
  select * into v_msg from public.messages where id = p_message_id for update;
  if not found or v_msg.attachment_path is null or not private.can_access_room(v_msg.room_id) then
    raise exception 'mark_media_viewed: mensagem indisponível' using errcode = '42501';
  end if;

  v_my_role := case when private.is_admin() then 'admin' else 'guest' end;
  if v_my_role = v_msg.sender_role then
    return v_msg.media_expires_at;
  end if;

  if v_msg.media_viewed_at is null then
    update public.messages
       set media_viewed_at = now(),
           media_expires_at = now() + interval '15 minutes'
     where id = p_message_id
     returning media_expires_at into v_msg.media_expires_at;
  end if;

  return v_msg.media_expires_at;
end;
$$;

revoke all on function public.mark_media_viewed(uuid) from public, anon;
grant execute on function public.mark_media_viewed(uuid) to authenticated;

-- Arquivos vencidos ainda não removidos (para a Edge Function purge-expired).
create function public.purge_expired_media()
returns table (message_id uuid, attachment_path text)
language sql
security definer
set search_path = ''
as $$
  select m.id, m.attachment_path
  from public.messages m
  where m.attachment_path is not null
    and not m.media_purged
    and m.media_expires_at is not null
    and m.media_expires_at <= now()
  limit 500;
$$;

create function public.purge_media_done(p_message_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set media_purged = true where id = any (p_message_ids);
$$;

revoke all on function public.purge_expired_media() from public, anon, authenticated;
revoke all on function public.purge_media_done(uuid[]) from public, anon, authenticated;
grant execute on function public.purge_expired_media() to service_role;
grant execute on function public.purge_media_done(uuid[]) to service_role;
