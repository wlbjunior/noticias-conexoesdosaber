-- Descartes de fontes gerais sem tema atribuído ("nenhum") não têm topic/theme
ALTER TABLE public.discarded_news ALTER COLUMN topic DROP NOT NULL;

-- last_news_refresh_at é consumido apenas pelo painel admin (autenticado)
REVOKE EXECUTE ON FUNCTION public.last_news_refresh_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.last_news_refresh_at() TO authenticated, service_role;