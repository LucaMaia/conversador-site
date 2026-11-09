-- =============================================================================
-- Schema principal do Mensageiro Privado Temporário
--
-- Princípio: o servidor só armazena dados cifrados e metadados mínimos.
-- Todos os valores binários (cifrados, IVs, sais) são guardados em base64.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Administradores (somente um na prática; a tabela é a fonte de autoridade)
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Cofre do admin: master key aleatória, cifrada por uma chave derivada
-- (PBKDF2) de uma frase que nunca sai do navegador.
-- -----------------------------------------------------------------------------
create table public.admin_vault (
  user_id            uuid primary key references public.admins (user_id) on delete cascade,
  kdf_salt           text not null check (length(kdf_salt) between 16 and 128),
  kdf_iterations     integer not null check (kdf_iterations >= 600000),
  wrapped_master_key text not null check (length(wrapped_master_key) between 16 and 256),
  wrap_iv            text not null check (wrap_iv ~ '^[A-Za-z0-9+/]{16}$'),
  created_at         timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Salas (conversas)
-- access_hash  = SHA-256 (hex) do access_token derivado do código via HKDF.
-- admin_code_* = código de convite cifrado pela master key do admin.
-- expires_at   = sempre created_at + 24h, imposto por trigger.
-- -----------------------------------------------------------------------------
create table public.rooms (
  id            uuid primary key default gen_random_uuid(),
  access_hash   text not null unique check (access_hash ~ '^[0-9a-f]{64}$'),
  admin_code_ct text not null check (length(admin_code_ct) between 16 and 512),
  admin_code_iv text not null check (admin_code_iv ~ '^[A-Za-z0-9+/]{16}$'),
  created_by    uuid not null references public.admins (user_id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  status        text not null default 'active' check (status in ('active', 'purging'))
);

create index rooms_expiry_idx on public.rooms (status, expires_at);

create function private.rooms_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Valores de tempo e estado nunca vêm do cliente.
  new.created_at := now();
  new.expires_at := new.created_at + interval '24 hours';
  new.status     := 'active';
  return new;
end;
$$;

create trigger rooms_before_insert
  before insert on public.rooms
  for each row execute function private.rooms_before_insert();

create function private.rooms_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.access_hash is distinct from old.access_hash
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at
     or new.created_by is distinct from old.created_by then
    raise exception 'rooms: campos imutáveis não podem ser alterados';
  end if;
  if old.status = 'purging' and new.status <> 'purging' then
    raise exception 'rooms: uma sala em limpeza não pode ser reativada';
  end if;
  return new;
end;
$$;

create trigger rooms_before_update
  before update on public.rooms
  for each row execute function private.rooms_before_update();

-- -----------------------------------------------------------------------------
-- Participação: no máximo 1 convidado por sala e 1 sala por sessão anônima.
-- Uma nova entrada com o código substitui a sessão de convidado anterior.
-- -----------------------------------------------------------------------------
create table public.room_members (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null default 'guest' check (role = 'guest'),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create unique index room_members_one_guest_per_room on public.room_members (room_id);
create unique index room_members_one_room_per_user on public.room_members (user_id);

-- -----------------------------------------------------------------------------
-- Mensagens: somente conteúdo cifrado (AES-256-GCM).
-- id é gerado no cliente porque faz parte do AAD da cifra.
-- sender_id, sender_role e created_at são impostos pelo servidor.
-- -----------------------------------------------------------------------------
create table public.messages (
  id              uuid primary key,
  room_id         uuid not null references public.rooms (id) on delete cascade,
  sender_id       uuid not null,
  sender_role     text not null check (sender_role in ('admin', 'guest')),
  ciphertext      text not null check (length(ciphertext) between 1 and 262144),
  iv              text not null check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  attachment_path text check (attachment_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  created_at      timestamptz not null default now(),
  constraint messages_attachment_in_room
    check (attachment_path is null or split_part(attachment_path, '/', 1) = room_id::text)
);

create index messages_room_created_idx on public.messages (room_id, created_at);

create function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.sender_id  := auth.uid();
  new.created_at := now();
  new.sender_role := case
    when exists (select 1 from public.admins a where a.user_id = auth.uid()) then 'admin'
    else 'guest'
  end;
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function private.messages_before_insert();

-- -----------------------------------------------------------------------------
-- Tentativas de entrada (limite contra força bruta). Acesso só via service_role.
-- ip_hash = HMAC-SHA256(IP, segredo do servidor), nunca o IP em texto.
-- -----------------------------------------------------------------------------
create table public.join_attempts (
  id           bigint generated always as identity primary key,
  ip_hash      text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  success      boolean not null,
  attempted_at timestamptz not null default now()
);

create index join_attempts_ip_idx on public.join_attempts (ip_hash, attempted_at);
