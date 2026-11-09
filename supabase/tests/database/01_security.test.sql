-- Testes de segurança do banco (pgTAP). Executar com: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, is_anonymous, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', false, now()),
  ('00000000-0000-0000-0000-0000000000b1', null, true, now()),
  ('00000000-0000-0000-0000-0000000000b2', null, true, now()),
  ('00000000-0000-0000-0000-0000000000b3', null, true, now()),
  ('00000000-0000-0000-0000-0000000000c1', 'intruso@test.local', false, now());

insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end; $$;

create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end; $$;

create function pg_temp.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;

create function pg_temp.hex64(p text) returns text language sql as $$
  select encode(extensions.digest(p, 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Criação de salas
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');

select lives_ok($$
  insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by)
  values (pg_temp.hex64('room-a'), 'Y2lwaGVydGV4dC1jb2RlLWE=', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-00000000000a')
$$, 'admin cria sala A');

select lives_ok($$
  insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by)
  values (pg_temp.hex64('room-b'), 'Y2lwaGVydGV4dC1jb2RlLWI=', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-00000000000a')
$$, 'admin cria sala B');

select throws_ok($$
  insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by, expires_at)
  values (pg_temp.hex64('room-x'), 'Y2lwaGVydGV4dC1jb2RlLXg=', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-00000000000a', now() + interval '30 days')
$$, '42501', null, 'admin não consegue definir expires_at');

select is(
  (select count(*)::int from public.rooms
   where expires_at = created_at + interval '24 hours' and status = 'active'),
  2, 'expiração imposta pelo servidor: exatamente 24h');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$
  insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by)
  values (pg_temp.hex64('room-g'), 'Y2lwaGVydGV4dC1jb2RlLWc=', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-0000000000b1')
$$, '42501', null, 'convidado não cria salas');

select is((select count(*)::int from public.rooms), 0, 'convidado não lista salas');
select is((select count(*)::int from public.admin_vault), 0, 'convidado não lê o cofre');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.rooms), 0, 'usuário não-admin não lista salas');

select pg_temp.reset_role();
create temp table ids as
  select
    (select id from public.rooms where access_hash = pg_temp.hex64('room-a')) as room_a,
    (select id from public.rooms where access_hash = pg_temp.hex64('room-b')) as room_b;
grant select on ids to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Acesso anônimo bloqueado
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.messages $$, '42501', null, 'anon sem acesso a messages');
select throws_ok($$ select * from public.rooms $$, '42501', null, 'anon sem acesso a rooms');
select pg_temp.reset_role();

-- ---------------------------------------------------------------------------
-- join_room: somente service_role; código válido; substituição de convidado
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$
  select public.join_room('00000000-0000-0000-0000-0000000000b1', pg_temp.hex64('room-a'), pg_temp.hex64('ip1'))
$$, '42501', null, 'cliente não chama join_room diretamente');

select pg_temp.as_service();
select is(
  public.join_room('00000000-0000-0000-0000-0000000000b1', pg_temp.hex64('room-a'), pg_temp.hex64('ip1')) ->> 'status',
  'ok', 'código válido entra na sala A');

select is(
  public.join_room('00000000-0000-0000-0000-0000000000c1', pg_temp.hex64('room-a'), pg_temp.hex64('ip1')) ->> 'status',
  'forbidden', 'apenas sessões anônimas entram como convidado');

select is(
  public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('room-b'), pg_temp.hex64('ip1')) ->> 'status',
  'ok', 'outra sessão entra na sala B');

-- ---------------------------------------------------------------------------
-- Mensagens: isolamento entre salas
-- ---------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$
  insert into public.messages (id, room_id, ciphertext, iv)
  values ('10000000-0000-0000-0000-000000000001', (select room_a from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA')
$$, 'convidado envia na própria sala');

select throws_ok($$
  insert into public.messages (id, room_id, ciphertext, iv)
  values ('10000000-0000-0000-0000-000000000002', (select room_b from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA')
$$, '42501', null, 'convidado não envia em outra sala');

select throws_ok($$
  insert into public.messages (id, room_id, ciphertext, iv, sender_id)
  values ('10000000-0000-0000-0000-000000000003', (select room_a from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-00000000000a')
$$, '42501', null, 'convidado não define sender_id');

select is(
  (select sender_role from public.messages where id = '10000000-0000-0000-0000-000000000001'),
  'guest', 'sender_role imposto pelo servidor');

select is(
  (select sender_id from public.messages where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'sender_id imposto pelo servidor');

select throws_ok($$
  update public.messages set ciphertext = 'YWx0ZXJhZG8=' where id = '10000000-0000-0000-0000-000000000001'
$$, '42501', null, 'mensagens não podem ser alteradas');

select is(
  (with d as (delete from public.messages returning 1) select count(*)::int from d),
  0, 'convidado não apaga mensagens');

select throws_ok($$
  insert into public.messages (id, room_id, ciphertext, iv, attachment_path)
  values ('10000000-0000-0000-0000-000000000004', (select room_a from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA',
          (select room_b from ids)::text || '/20000000-0000-0000-0000-000000000001')
$$, '23514', null, 'anexo precisa estar na pasta da própria sala');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select is((select count(*)::int from public.messages), 0, 'convidado da sala B não vê mensagens da sala A');
select is((select count(*)::int from public.get_room_info((select room_a from ids))), 0,
  'convidado da sala B não obtém informações da sala A');
select is((select count(*)::int from public.get_room_info((select room_b from ids))), 1,
  'convidado obtém informações da própria sala');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok($$
  insert into public.messages (id, room_id, ciphertext, iv)
  values ('10000000-0000-0000-0000-000000000005', (select room_a from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA')
$$, 'admin envia em qualquer sala ativa');
select is(
  (select sender_role from public.messages where id = '10000000-0000-0000-0000-000000000005'),
  'admin', 'mensagem do admin marcada como admin');

-- ---------------------------------------------------------------------------
-- Substituição do convidado: nova sessão com o código derruba a anterior
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select is(
  public.join_room('00000000-0000-0000-0000-0000000000b2', pg_temp.hex64('room-a'), pg_temp.hex64('ip2')) ->> 'status',
  'ok', 'nova sessão entra na sala A');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.messages), 0, 'sessão substituída perde o acesso');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.messages), 2, 'sessão atual lê o histórico da sala');

-- ---------------------------------------------------------------------------
-- Limite de tentativas
-- ---------------------------------------------------------------------------
select pg_temp.as_service();
select is(public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('errado-1'), pg_temp.hex64('ip-bf')) ->> 'status', 'invalid', 'código inválido 1');
select public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('errado-2'), pg_temp.hex64('ip-bf'));
select public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('errado-3'), pg_temp.hex64('ip-bf'));
select public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('errado-4'), pg_temp.hex64('ip-bf'));
select public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('errado-5'), pg_temp.hex64('ip-bf'));
select is(
  public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('room-b'), pg_temp.hex64('ip-bf')) ->> 'status',
  'rate_limited', 'após 5 falhas, até o código correto é bloqueado');

-- ---------------------------------------------------------------------------
-- Expiração: acesso bloqueado no instante exato, mesmo antes da limpeza
-- ---------------------------------------------------------------------------
select pg_temp.reset_role();
alter table public.rooms disable trigger rooms_before_update;
update public.rooms set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
 where id = (select room_a from ids);
alter table public.rooms enable trigger rooms_before_update;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.messages), 0, 'convidado não lê sala expirada');
select throws_ok($$
  insert into public.messages (id, room_id, ciphertext, iv)
  values ('10000000-0000-0000-0000-000000000006', (select room_a from ids), 'Y2lwaGVy', 'AAAAAAAAAAAAAAAA')
$$, '42501', null, 'convidado não envia em sala expirada');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.messages where room_id = (select room_a from ids)), 0,
  'admin também não lê conteúdo expirado');

select pg_temp.as_service();
select is(
  public.join_room('00000000-0000-0000-0000-0000000000b3', pg_temp.hex64('room-a'), pg_temp.hex64('ip3')) ->> 'status',
  'invalid', 'código de sala expirada é recusado');

-- ---------------------------------------------------------------------------
-- Limpeza
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(x) from public.purge_mark_expired() x),
  array[(select room_a from ids)], 'sala expirada marcada para limpeza');

select pg_temp.reset_role();
select is((select count(*)::int from public.messages where room_id = (select room_a from ids)), 0,
  'mensagens da sala expirada apagadas do banco');

select pg_temp.as_service();
select ok(public.purge_finalize_room((select room_a from ids)), 'sala removida após limpeza');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.purge_mark_room((select room_b from ids)) $$, '42501', null,
  'cliente não executa a limpeza');

-- ---------------------------------------------------------------------------
-- Hook de cadastro
-- ---------------------------------------------------------------------------
select pg_temp.reset_role();
select is(public.hook_before_user_created('{"user":{"is_anonymous":true}}'), '{}'::jsonb,
  'hook permite sessão anônima');
select is(public.hook_before_user_created('{"user":{"is_anonymous":false,"email":"x@y.z","user_metadata":{"provisioned":"admin-seed"}}}') -> 'error' ->> 'http_code',
  '403', 'hook recusa cadastro público, mesmo com user_metadata forjado');

select * from finish();
rollback;
