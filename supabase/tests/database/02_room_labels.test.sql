-- Testes do nome cifrado das conversas (pgTAP). Executar com: supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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

select lives_ok($$
  insert into public.rooms (access_hash, admin_code_ct, admin_code_iv, created_by, admin_label_ct, admin_label_iv)
  values (repeat('a', 64), 'Y2lwaGVydGV4dC1jb2RlLWE=', 'AAAAAAAAAAAAAAAA',
          '00000000-0000-0000-0000-00000000000a', 'bm9tZS1jaWZyYWRvLWE=', 'BBBBBBBBBBBBBBBB')
$$, 'admin cria sala com nome cifrado');

select lives_ok($$
  update public.rooms set admin_label_ct = 'bm92by1ub21lLWNpZnJhZG8=', admin_label_iv = 'CCCCCCCCCCCCCCCC'
$$, 'admin renomeia a sala');

select is((select admin_label_iv from public.rooms), 'CCCCCCCCCCCCCCCC', 'nome atualizado');

select throws_ok($$ update public.rooms set expires_at = now() + interval '30 days' $$,
  '42501', null, 'admin não altera o prazo');

select throws_ok($$ update public.rooms set admin_label_ct = 'bm9tZS1jaWZyYWRvLWE=', admin_label_iv = null $$,
  '23514', null, 'nome e IV andam juntos');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select is(
  (with u as (update public.rooms set admin_label_ct = null, admin_label_iv = null returning 1)
   select count(*)::int from u),
  0, 'convidado não altera o nome');

select * from finish();
rollback;
