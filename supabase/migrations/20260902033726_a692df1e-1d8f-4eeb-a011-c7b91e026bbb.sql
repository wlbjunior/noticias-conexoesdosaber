-- 1) Pautas
CREATE TABLE public.pautas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid REFERENCES public.news(id) ON DELETE SET NULL,
  title text NOT NULL,
  angle text,
  theme_id uuid REFERENCES public.themes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sugerida' CHECK (status IN ('sugerida','aprovada','em_producao','publicada','descartada')),
  assignee text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pautas_status_idx ON public.pautas(status);
CREATE INDEX pautas_news_id_idx ON public.pautas(news_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pautas TO authenticated;
GRANT ALL ON public.pautas TO service_role;

ALTER TABLE public.pautas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editorial staff read pautas" ON public.pautas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Editorial staff insert pautas" ON public.pautas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Editorial staff update pautas" ON public.pautas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Editorial staff delete pautas" ON public.pautas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER pautas_set_updated_at BEFORE UPDATE ON public.pautas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Painel: agregados no banco
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    'pautas_open', (SELECT count(*) FROM public.pautas WHERE status IN ('sugerida','aprovada','em_producao'))
  ) INTO result;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- 3) Resumo por integração
CREATE OR REPLACE FUNCTION public.admin_integration_summary()
RETURNS TABLE (
  integration text,
  total_calls bigint,
  avg_duration_ms numeric,
  last_called_at timestamptz,
  last_ok boolean,
  last_http_status integer,
  last_error text,
  total_items_in bigint,
  total_items_new bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ic.integration,
    count(*) AS total_calls,
    round(avg(ic.duration_ms)::numeric, 0) AS avg_duration_ms,
    max(ic.called_at) AS last_called_at,
    (array_agg(ic.ok ORDER BY ic.called_at DESC))[1] AS last_ok,
    (array_agg(ic.http_status ORDER BY ic.called_at DESC))[1] AS last_http_status,
    (array_agg(ic.error ORDER BY ic.called_at DESC))[1] AS last_error,
    coalesce(sum(ic.items_in), 0) AS total_items_in,
    coalesce(sum(ic.items_new), 0) AS total_items_new
  FROM public.integration_calls ic
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  GROUP BY ic.integration;
$$;

REVOKE ALL ON FUNCTION public.admin_integration_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_integration_summary() TO authenticated;

-- 4) Domínios bloqueados: mesma origem para front e coletor
CREATE OR REPLACE FUNCTION public.get_blocked_domains()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(
    (SELECT array_agg(d) FROM public.app_settings s, jsonb_array_elements_text(s.value) AS d WHERE s.key = 'blocked_domains' AND jsonb_typeof(s.value) = 'array'),
    '{}'::text[]
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_domains() TO anon, authenticated;