-- Mensagem de boas-vindas do sistema (pgTAP). Executar com: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, is_anonymous, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', false, now()),
  ('00000000-0000-0000-0000-0000000000b1', null, true, now());
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end; $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by)
values (repeat('c', 64), 'Y2lwaGVydGV4dC1jb2RlLWM=', 'AAAAAAAAAAAAAAAA', '00000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.messages where sender_role = 'system'), 1,
  'sala nova recebe exatamente uma mensagem de boas-vindas');
select is((select system_template from public.messages where sender_role = 'system'), 'welcome_v1',
  'o banco guarda só o identificador do modelo');
select ok((select ciphertext is null from public.messages where sender_role = 'system'),
  'nenhum texto da mensagem oficial é guardado no servidor');
select is((select m.created_at from public.messages m), (select r.created_at from public.rooms r),
  'mesmo horário da criação da sala (primeira do histórico)');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok($$
  insert into public.messages (id, room_id, system_template)
  values (gen_random_uuid(), (select id from public.rooms), 'welcome_v1')
$$, '42501', null, 'admin não cria mensagem do sistema pela API');

set local role postgres;
select throws_ok($$
  insert into public.messages (id, room_id, sender_id, sender_role, system_template)
  values (gen_random_uuid(), (select id from public.rooms), '00000000-0000-0000-0000-00000000000a', 'system', 'welcome_v1')
$$, '23505', null, 'índice único impede duplicar as boas-vindas');

select throws_ok($$
  insert into public.messages (id, room_id, sender_id, sender_role, system_template)
  values (gen_random_uuid(), (select id from public.rooms), '00000000-0000-0000-0000-00000000000a', 'system', 'outro')
$$, '23514', null, 'só modelos conhecidos');

delete from public.rooms;
select is((select count(*)::int from public.messages), 0, 'apagada junto com a sala');

select * from finish();
rollback;
