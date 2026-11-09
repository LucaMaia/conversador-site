-- =============================================================================
-- Nome da conversa (rótulo do admin), cifrado pela master key do cofre.
-- O servidor não conhece o nome; o convidado não tem acesso à tabela rooms.
-- =============================================================================

alter table public.rooms
  add column admin_label_ct text check (admin_label_ct is null or length(admin_label_ct) between 16 and 512),
  add column admin_label_iv text check (admin_label_iv is null or admin_label_iv ~ '^[A-Za-z0-9+/]{16}$'),
  add constraint rooms_label_pair check ((admin_label_ct is null) = (admin_label_iv is null));

-- O admin pode definir o nome ao criar e alterá-lo depois — e nada mais.
-- (O trigger rooms_before_update continua impedindo mudanças em prazos e hash.)
grant insert (admin_label_ct, admin_label_iv) on public.rooms to authenticated;
grant update (admin_label_ct, admin_label_iv) on public.rooms to authenticated;

create policy rooms_update_label_admin on public.rooms
  for update to authenticated
  using ((select private.is_admin()) and status = 'active')
  with check ((select private.is_admin()) and status = 'active');
