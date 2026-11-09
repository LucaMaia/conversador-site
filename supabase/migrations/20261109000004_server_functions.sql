-- =============================================================================
-- Funções executadas apenas pelo servidor (Edge Functions com service_role)
-- e o hook de Auth que bloqueia cadastro público.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- join_room: valida o código (via hash) com limite de tentativas por IP.
-- Retorna jsonb (não lança exceção em falha, para que a tentativa seja gravada).
--   { "status": "ok", "room_id": ..., "expires_at": ... }
--   { "status": "invalid" }
--   { "status": "rate_limited", "retry_after_seconds": n }
--   { "status": "forbidden" }   -- usuário não é uma sessão anônima
-- -----------------------------------------------------------------------------
create function public.join_room(p_user_id uuid, p_access_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_failures constant integer  := 5;
  c_window       constant interval := interval '15 minutes';
  v_failures     integer;
  v_oldest       timestamptz;
  v_room         public.rooms%rowtype;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'join_room: ip_hash inválido';
  end if;

  select count(*), min(attempted_at)
    into v_failures, v_oldest
  from public.join_attempts
  where ip_hash = p_ip_hash
    and not success
    and attempted_at > now() - c_window;

  if v_failures >= c_max_failures then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v_oldest + c_window - now()))))::integer
    );
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.is_anonymous
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select * into v_room
  from public.rooms r
  where r.access_hash = p_access_hash
    and r.status = 'active'
    and r.expires_at > now()
  for update;

  if not found then
    insert into public.join_attempts (ip_hash, success) values (p_ip_hash, false);
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.join_attempts (ip_hash, success) values (p_ip_hash, true);

  -- Uma sessão anônima pertence a no máximo uma sala, e cada sala tem
  -- no máximo um convidado: a nova sessão substitui a anterior.
  delete from public.room_members
  where (room_id = v_room.id or user_id = p_user_id);

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, p_user_id, 'guest');

  return jsonb_build_object(
    'status', 'ok',
    'room_id', v_room.id,
    'expires_at', v_room.expires_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Limpeza
-- -----------------------------------------------------------------------------

-- Marca salas vencidas como 'purging' e apaga imediatamente as mensagens
-- (linhas do banco). Retorna todas as salas pendentes de limpeza de arquivos.
create function public.purge_mark_expired()
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms
     set status = 'purging'
   where status = 'active' and expires_at <= now();

  delete from public.messages m
   using public.rooms r
   where m.room_id = r.id and r.status = 'purging';

  delete from public.room_members rm
   using public.rooms r
   where rm.room_id = r.id and r.status = 'purging';

  return query select r.id from public.rooms r where r.status = 'purging';
end;
$$;

-- Exclusão manual: o mesmo fluxo para uma sala específica.
create function public.purge_mark_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms set status = 'purging' where id = p_room_id;
  if not found then
    return false;
  end if;
  delete from public.messages where room_id = p_room_id;
  delete from public.room_members where room_id = p_room_id;
  return true;
end;
$$;

-- Etapa final, depois que os arquivos do Storage foram removidos.
create function public.purge_finalize_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rooms where id = p_room_id and status = 'purging';
  return found;
end;
$$;

-- Remove sessões anônimas que não pertencem a nenhuma sala há mais de 1h,
-- e registros antigos de tentativas de entrada.
create function public.purge_housekeeping()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users    integer;
  v_attempts integer;
begin
  delete from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from public.room_members m where m.user_id = u.id);
  get diagnostics v_users = row_count;

  delete from public.join_attempts where attempted_at < now() - interval '1 day';
  get diagnostics v_attempts = row_count;

  return jsonb_build_object('anonymous_users', v_users, 'join_attempts', v_attempts);
end;
$$;

revoke all on function public.join_room(uuid, text, text) from public, anon, authenticated;
revoke all on function public.purge_mark_expired() from public, anon, authenticated;
revoke all on function public.purge_mark_room(uuid) from public, anon, authenticated;
revoke all on function public.purge_finalize_room(uuid) from public, anon, authenticated;
revoke all on function public.purge_housekeeping() from public, anon, authenticated;
grant execute on function public.join_room(uuid, text, text) to service_role;
grant execute on function public.purge_mark_expired() to service_role;
grant execute on function public.purge_mark_room(uuid) to service_role;
grant execute on function public.purge_finalize_room(uuid) to service_role;
grant execute on function public.purge_housekeeping() to service_role;

-- -----------------------------------------------------------------------------
-- Hook "before user created": não existe cadastro público.
-- Permitido apenas:
--   * sessões anônimas (participantes);
--   * usuários criados pelo script local com app_metadata.provisioned = 'admin-seed'
--     (app_metadata não pode ser definido por um cadastro público).
-- -----------------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user jsonb := event -> 'user';
begin
  if coalesce((v_user ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;

  if v_user -> 'app_metadata' ->> 'provisioned' = 'admin-seed' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'Cadastro desativado.')
  );
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
