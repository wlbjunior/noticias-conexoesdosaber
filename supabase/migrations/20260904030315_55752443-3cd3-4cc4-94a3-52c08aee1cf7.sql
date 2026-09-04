CREATE TABLE public.briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.newsletter_subscriptions(id) ON DELETE CASCADE,
  subject text NOT NULL,
  news_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('enviado','falhou')),
  provider_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX briefings_subscriber_idx ON public.briefings (subscriber_id, sent_at DESC);
GRANT SELECT ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editorial staff read briefings" ON public.briefings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT jsonb_build_object(
    'news_published', (SELECT count(*) FROM public.news WHERE status = 'publicada'),
    'news_archived', (SELECT count(*) FROM public.news WHERE status = 'arquivada'),
    'collected_24h', (SELECT coalesce(sum(items_in), 0) FROM public.integration_calls WHERE integration = 'ingestao' AND called_at > now() - interval '24 hours'),
    'new_24h', (SELECT coalesce(sum(items_new), 0) FROM public.integration_calls WHERE integration = 'ingestao' AND called_at > now() - interval '24 hours'),
    'ingest_runs_24h', (SELECT count(*) FROM public.integration_calls WHERE integration = 'ingestao' AND called_at > now() - interval '24 hours'),
    'sources_active', (SELECT count(*) FROM public.sources WHERE active),
    'sources_failing', (SELECT count(*) FROM public.sources WHERE active AND last_status = 'erro'),
    'avg_relevance', (SELECT round(avg(relevance)::numeric, 1) FROM public.news_analysis WHERE relevance IS NOT NULL),
    'analysis_count', (SELECT count(*) FROM public.news_analysis),
    'discarded_spam_24h', (SELECT count(*) FROM public.discarded_news WHERE discarded_at > now() - interval '24 hours' AND reason ILIKE '%spam%'),
    'discarded_irrelevant_24h', (SELECT count(*) FROM public.discarded_news WHERE discarded_at > now() - interval '24 hours' AND (reason IS NULL OR reason NOT ILIKE '%spam%')),
    'pautas_open', (SELECT count(*) FROM public.pautas WHERE status IN ('sugerida','aprovada','em_producao')),
    'last_published_at', (SELECT max(published_at) FROM public.news WHERE status = 'publicada'),
    'ai_last_http_status', (SELECT http_status FROM public.integration_calls WHERE integration = 'lovable_ai' ORDER BY called_at DESC LIMIT 1),
    'ai_last_ok', (SELECT ok FROM public.integration_calls WHERE integration = 'lovable_ai' ORDER BY called_at DESC LIMIT 1),
    'ai_last_called_at', (SELECT called_at FROM public.integration_calls WHERE integration = 'lovable_ai' ORDER BY called_at DESC LIMIT 1),
    'pending_analysis', (SELECT count(*) FROM public.news n WHERE NOT EXISTS (SELECT 1 FROM public.news_analysis a WHERE a.news_id = n.id)),
    'pending_analysis_stale', (SELECT count(*) FROM public.news n WHERE n.fetched_at < now() - interval '24 hours' AND NOT EXISTS (SELECT 1 FROM public.news_analysis a WHERE a.news_id = n.id)),
    'last_briefing_at', (SELECT max(sent_at) FROM public.briefings WHERE status = 'enviado')
  ) INTO result;
  RETURN result;
END $function$;

SELECT cron.schedule(
  'daily-newsletter-briefing',
  '0 11 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://yfyhpgskbvtfjkyiyuwj.supabase.co/functions/v1/send-newsletter',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmeWhwZ3NrYnZ0ZmpreWl5dXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MDE0MDksImV4cCI6MjA4Mjk3NzQwOX0.DPhIyVUBs9R-qX6b142Jm5kKC_1uPzzQGIkWHiNMqFk"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $cron$
);