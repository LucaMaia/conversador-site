-- =============================================================================
-- Limpeza automática no servidor, a cada minuto, sem depender do navegador.
--
--   1) No próprio banco: marca salas vencidas e apaga mensagens e participação.
--   2) Chama a Edge Function purge-expired, que remove do Storage os arquivos
--      de salas vencidas e as imagens vistas há mais de 15 minutos.
--
-- O acesso já é bloqueado pela RLS no instante exato da expiração; esta rotina
-- faz a remoção física (em até ~1 minuto).
--
-- A função purge-expired só atua sobre dados que o próprio servidor considera
-- vencidos, por isso pode ser chamada sem segredo (chamadas extras não têm efeito).
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname in ('purge-expired-db', 'purge-expired-files');

select cron.schedule(
  'purge-expired-db',
  '* * * * *',
  $$ select public.purge_mark_expired(); $$
);

select cron.schedule(
  'purge-expired-files',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://uezdqkbdydbtteolprzl.supabase.co/functions/v1/purge-expired',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
