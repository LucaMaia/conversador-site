-- =============================================================================
-- Funções auxiliares de autorização e políticas RLS
-- =============================================================================

-- Defesa em profundidade: o papel anon não acessa nenhuma tabela.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- -----------------------------------------------------------------------------
-- Funções auxiliares (schema private não é exposto pela API)
-- -----------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create function private.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Acesso ao conteúdo de uma sala: sala ativa, não expirada,
-- e o usuário é o admin ou o convidado atual daquela sala.
create function private.can_access_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.status = 'active'
      and r.expires_at > now()
      and (
        exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
        or exists (
          select 1 from public.room_members m
          where m.room_id = r.id and m.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.try_uuid(text) from public;
revoke all on function private.can_access_room(uuid) from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.try_uuid(text) to authenticated;
grant execute on function private.can_access_room(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.admins        enable row level security;
alter table public.admin_vault   enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_members  enable row level security;
alter table public.messages      enable row level security;
alter table public.join_attempts enable row level security;

-- admins: o admin consegue confirmar o próprio papel. Nenhuma escrita via API.
create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- admin_vault: só o próprio admin lê e cria (uma vez). Sem update/delete.
create policy admin_vault_select_own on public.admin_vault
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_admin()));

create policy admin_vault_insert_own on public.admin_vault
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_admin()));

-- rooms: somente o admin lista e cria. Convidados usam get_room_info().
create policy rooms_select_admin on public.rooms
  for select to authenticated
  using ((select private.is_admin()));

create policy rooms_insert_admin on public.rooms
  for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- room_members: o admin vê se há convidado; o convidado vê a própria linha.
-- Escrita somente pela função join_room (service_role).
create policy room_members_select on public.room_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- messages: leitura e escrita somente para quem pode acessar a sala.
create policy messages_select on public.messages
  for select to authenticated
  using (private.can_access_room(room_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (private.can_access_room(room_id));

-- join_attempts: sem políticas => inacessível para anon/authenticated.

-- Privilégios mínimos por tabela para authenticated.
revoke all on public.admins, public.admin_vault, public.rooms,
              public.room_members, public.messages, public.join_attempts
  from authenticated;
grant select on public.admins to authenticated;
grant select, insert on public.admin_vault to authenticated;
grant select on public.rooms to authenticated;
grant insert (access_hash, admin_code_ct, admin_code_iv, created_by) on public.rooms to authenticated;
grant select on public.room_members to authenticated;
grant select on public.messages to authenticated;
grant insert (id, room_id, ciphertext, iv, attachment_path) on public.messages to authenticated;

-- -----------------------------------------------------------------------------
-- RPCs públicas
-- -----------------------------------------------------------------------------

-- Hora do servidor (o contador regressivo não confia no relógio do aparelho).
create function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;

-- Informações mínimas da sala para quem tem acesso a ela.
create function public.get_room_info(p_room_id uuid)
returns table (id uuid, created_at timestamptz, expires_at timestamptz, server_now timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.created_at, r.expires_at, now()
  from public.rooms r
  where r.id = p_room_id and private.can_access_room(r.id);
$$;

revoke all on function public.server_now() from public, anon;
revoke all on function public.get_room_info(uuid) from public, anon;
grant execute on function public.server_now() to authenticated;
grant execute on function public.get_room_info(uuid) to authenticated;

-- Realtime: mudanças em messages respeitam a RLS de select.
alter publication supabase_realtime add table public.messages;
