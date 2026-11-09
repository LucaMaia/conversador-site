-- =============================================================================
-- Correções da auditoria de limpeza
--
-- 1) O histórico do pg_cron (cron.job_run_details) ganha ~2 linhas por minuto
--    e nunca é apagado pelo Supabase. Sem isto, cresceria ~2,4 MB/dia.
-- 2) Arquivos órfãos: upload concluído, mas a mensagem nunca foi registrada
--    (envio interrompido). Antes só saíam com a sala (até 24h); agora saem
--    15 minutos depois do upload.
-- =============================================================================

-- 1) Histórico do agendador: mantém só as últimas 24h.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-history';
select cron.schedule(
  'purge-cron-history',
  '17 * * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '1 day'; $$
);

-- 2) Arquivos sem mensagem há mais de 15 minutos (margem para envios em andamento).
create function public.purge_orphan_objects()
returns table (object_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'attachments'
    and o.created_at < now() - interval '15 minutes'
    and not exists (select 1 from public.messages m where m.attachment_path = o.name)
  limit 500;
$$;

revoke all on function public.purge_orphan_objects() from public, anon, authenticated;
grant execute on function public.purge_orphan_objects() to service_role;
