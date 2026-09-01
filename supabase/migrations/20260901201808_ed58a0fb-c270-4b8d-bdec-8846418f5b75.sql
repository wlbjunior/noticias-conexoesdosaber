CREATE OR REPLACE FUNCTION public.last_news_refresh_at()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(called_at) FROM public.integration_calls
  WHERE integration = 'google_news_rss' AND ok = true;
$$;

DROP VIEW public.news_refresh_control;
CREATE VIEW public.news_refresh_control WITH (security_invoker = true) AS
  SELECT public.last_news_refresh_at() AS last_refresh_at;
GRANT SELECT ON public.news_refresh_control TO anon, authenticated, service_role;

ALTER TABLE public.news ALTER COLUMN url_hash SET DEFAULT '';