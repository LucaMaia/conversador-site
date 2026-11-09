-- =============================================================================
-- Mensagem de boas-vindas do sistema em toda conversa nova.
--
-- Segurança: o banco NÃO guarda o texto, apenas o identificador do modelo
-- (system_template = 'welcome_v1'). O texto oficial vive no código do site.
-- Assim, quem controla o servidor não consegue forjar uma "mensagem oficial"
-- com conteúdo arbitrário — só disparar modelos que o site já conhece.
--
-- Garantias:
--  * criada pelo gatilho na MESMA transação que cria a sala;
--  * índice único: no máximo uma por sala e modelo;
--  * clientes não conseguem criar mensagens do sistema (sem permissão na
--    coluna system_template e o gatilho de mensagens impõe admin/guest);
--  * apagada junto com a sala (ON DELETE CASCADE / limpeza de 24h).
-- =============================================================================

alter table public.messages
  drop constraint messages_sender_role_check,
  add constraint messages_sender_role_check check (sender_role in ('admin', 'guest', 'system')),
  alter column ciphertext drop not null,
  alter column iv drop not null,
  add column system_template text check (system_template in ('welcome_v1')),
  add constraint messages_system_shape check (
    (sender_role = 'system' and system_template is not null
       and ciphertext is null and iv is null and attachment_path is null)
    or
    (sender_role <> 'system' and system_template is null
       and ciphertext is not null and iv is not null)
  );

create unique index messages_one_system_template_per_room
  on public.messages (room_id, system_template)
  where system_template is not null;

-- O gatilho de mensagens continua impondo remetente e horário para clientes.
-- system_template só pode vir do próprio banco (clientes não têm permissão
-- de escrita nessa coluna), então essas linhas mantêm o papel 'system'.
create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.system_template is not null then
    new.sender_role := 'system';
    return new;
  end if;

  new.sender_id  := auth.uid();
  new.created_at := now();
  new.sender_role := case
    when exists (select 1 from public.admins a where a.user_id = auth.uid()) then 'admin'
    else 'guest'
  end;
  return new;
end;
$$;

-- Boas-vindas: mesma transação e mesmo horário da criação da sala.
create function private.rooms_after_insert_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.messages (id, room_id, sender_id, sender_role, system_template, created_at)
  values (gen_random_uuid(), new.id, new.created_by, 'system', 'welcome_v1', new.created_at)
  on conflict do nothing;
  return new;
end;
$$;

create trigger rooms_after_insert_welcome
  after insert on public.rooms
  for each row execute function private.rooms_after_insert_welcome();

-- Painel: a mensagem do sistema não conta como não lida nem como "última mensagem".
create or replace function public.admin_room_activity()
returns table (room_id uuid, unread integer, last_message_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         count(m.id) filter (where m.sender_role = 'guest' and m.created_at > r.admin_last_read_at)::integer,
         max(m.created_at) filter (where m.sender_role <> 'system')
  from public.rooms r
  left join public.messages m on m.room_id = r.id
  where private.is_admin() and r.status = 'active'
  group by r.id;
$$;
