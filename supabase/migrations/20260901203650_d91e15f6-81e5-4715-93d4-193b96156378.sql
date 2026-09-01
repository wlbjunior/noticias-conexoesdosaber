-- 1) sources: novo tipo "rss" com URL direta; tema opcional (fontes gerais)
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.sources ALTER COLUMN theme_id DROP NOT NULL;
ALTER TABLE public.sources ALTER COLUMN query DROP NOT NULL;
ALTER TABLE public.sources ALTER COLUMN query SET DEFAULT '';

ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_kind_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_kind_check CHECK (kind IN ('google_news_rss', 'rss'));
ALTER TABLE public.sources DROP CONSTRAINT IF EXISTS sources_kind_payload_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_kind_payload_check CHECK (
  (kind = 'google_news_rss' AND coalesce(query, '') <> '')
  OR (kind = 'rss' AND url IS NOT NULL AND url ~* '^https?://')
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_rss_url_unique ON public.sources (url) WHERE kind = 'rss';

-- 2) Código morto: news_refresh_control (view derivada, nunca renderizada)
DROP VIEW IF EXISTS public.news_refresh_control;
GRANT EXECUTE ON FUNCTION public.last_news_refresh_at() TO anon, authenticated, service_role;

-- 3) Cadastro das 11 fontes RSS diretas validadas
INSERT INTO public.sources (theme_id, kind, name, query, url, max_items)
SELECT t.id, 'rss', v.name, '', v.url, v.max_items
FROM (VALUES
  ('Café História',                    'https://www.cafehistoria.com.br/feed/',                 'mitologia',  20),
  ('Revista Cult',                     'https://revistacult.uol.com.br/home/feed/',             'filosofia',  20),
  ('Vatican News (PT)',                'https://www.vaticannews.va/pt.rss.xml',                 'religiao',   30),
  ('CNBB',                             'https://www.cnbb.org.br/feed/',                         'religiao',   20),
  ('G1 Pop & Arte',                    'https://g1.globo.com/rss/g1/pop-arte/',                 'artes',      30),
  ('Agência Brasil — Cultura',         'https://agenciabrasil.ebc.com.br/rss/cultura/feed.xml', 'artes',      20),
  ('Conselho Federal de Psicologia',   'https://site.cfp.org.br/feed/',                         'psicologia', 20)
) AS v(name, url, slug, max_items)
JOIN public.themes t ON t.slug = v.slug
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (theme_id, kind, name, query, url, max_items)
VALUES
  (NULL, 'rss', 'Super Interessante', '', 'https://super.abril.com.br/feed/',          40),
  (NULL, 'rss', 'Nexo Jornal',        '', 'https://www.nexojornal.com.br/rss.xml',      30),
  (NULL, 'rss', 'Outras Palavras',    '', 'https://outraspalavras.net/feed/',           20),
  (NULL, 'rss', 'BBC Brasil',         '', 'https://feeds.bbci.co.uk/portuguese/rss.xml', 40)
ON CONFLICT DO NOTHING;