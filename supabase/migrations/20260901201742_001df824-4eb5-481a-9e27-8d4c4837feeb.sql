-- ============ 1) THEMES ============
CREATE TABLE public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.themes TO anon, authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Themes are publicly readable" ON public.themes FOR SELECT USING (true);
CREATE POLICY "Admins manage themes" ON public.themes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.themes (slug, name, description, color, sort_order) VALUES
  ('mitologia',  'Mitologia',  'Mitos, deuses e narrativas fundadoras das culturas.', 'hsl(230, 70%, 30%)', 1),
  ('filosofia',  'Filosofia',  'Pensadores, correntes e reflexões éticas.',            'hsl(35, 85%, 35%)',  2),
  ('religiao',   'Religião',   'Religião, espiritualidade e fé.',                      'hsl(250, 50%, 32%)', 3),
  ('artes',      'Artes',      'Arte, cultura e expressões artísticas.',                'hsl(340, 70%, 35%)', 4),
  ('psicologia', 'Psicologia', 'Psicologia, saúde mental e bem-estar.',                 'hsl(160, 65%, 25%)', 5);

-- theme_id nas 4 tabelas + backfill
ALTER TABLE public.news           ADD COLUMN theme_id uuid REFERENCES public.themes(id);
ALTER TABLE public.discarded_news ADD COLUMN theme_id uuid REFERENCES public.themes(id);
ALTER TABLE public.internal_news  ADD COLUMN theme_id uuid REFERENCES public.themes(id);
ALTER TABLE public.news_clicks    ADD COLUMN theme_id uuid REFERENCES public.themes(id);

UPDATE public.news n           SET theme_id = t.id FROM public.themes t WHERE t.slug = n.topic::text;
UPDATE public.discarded_news n SET theme_id = t.id FROM public.themes t WHERE t.slug = n.topic::text;
UPDATE public.internal_news n  SET theme_id = t.id FROM public.themes t WHERE t.slug = n.topic::text;
UPDATE public.news_clicks n    SET theme_id = t.id FROM public.themes t WHERE t.slug = n.topic;

CREATE INDEX news_theme_id_idx ON public.news(theme_id);
CREATE INDEX discarded_news_theme_id_idx ON public.discarded_news(theme_id);
CREATE INDEX internal_news_theme_id_idx ON public.internal_news(theme_id);
CREATE INDEX news_clicks_theme_id_idx ON public.news_clicks(theme_id);

-- gatilho de sincronização topic <-> theme_id (topic permanece até a rodada 3)
CREATE OR REPLACE FUNCTION public.sync_topic_theme()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_slug text; v_id uuid;
BEGIN
  IF NEW.theme_id IS NULL AND NEW.topic IS NOT NULL THEN
    SELECT id INTO v_id FROM public.themes WHERE slug = NEW.topic::text;
    NEW.theme_id := v_id;
  ELSIF NEW.theme_id IS NOT NULL AND (NEW.topic IS NULL OR TG_OP = 'UPDATE') THEN
    SELECT slug INTO v_slug FROM public.themes WHERE id = NEW.theme_id;
    IF v_slug IS NOT NULL AND (NEW.topic IS NULL OR NEW.topic::text <> v_slug) THEN
      -- se theme_id mudou explicitamente, topic segue; se topic mudou, theme_id segue
      IF TG_OP = 'UPDATE' AND NEW.topic::text IS DISTINCT FROM OLD.topic::text AND NEW.theme_id = OLD.theme_id THEN
        SELECT id INTO v_id FROM public.themes WHERE slug = NEW.topic::text;
        NEW.theme_id := v_id;
      ELSE
        NEW.topic := v_slug;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER news_sync_topic_theme           BEFORE INSERT OR UPDATE ON public.news           FOR EACH ROW EXECUTE FUNCTION public.sync_topic_theme();
CREATE TRIGGER discarded_news_sync_topic_theme BEFORE INSERT OR UPDATE ON public.discarded_news FOR EACH ROW EXECUTE FUNCTION public.sync_topic_theme();
CREATE TRIGGER internal_news_sync_topic_theme  BEFORE INSERT OR UPDATE ON public.internal_news  FOR EACH ROW EXECUTE FUNCTION public.sync_topic_theme();
CREATE TRIGGER news_clicks_sync_topic_theme    BEFORE INSERT OR UPDATE ON public.news_clicks    FOR EACH ROW EXECUTE FUNCTION public.sync_topic_theme();

-- ============ 2) SOURCES ============
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'google_news_rss',
  name text NOT NULL,
  query text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  max_items int NOT NULL DEFAULT 20,
  last_run_at timestamptz,
  last_status text NOT NULL DEFAULT 'nunca' CHECK (last_status IN ('ok','erro','nunca')),
  last_error text,
  consecutive_failures int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and moderators read sources" ON public.sources FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Admins manage sources" ON public.sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sources_set_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sources (theme_id, kind, name, query)
SELECT t.id, 'google_news_rss', 'Google News: ' || q.query, q.query
FROM (VALUES
  ('mitologia',  'mitologia grega'),
  ('mitologia',  'mitologia nórdica'),
  ('filosofia',  'filosofia'),
  ('filosofia',  'filósofos pensadores'),
  ('religiao',   'religião espiritualidade'),
  ('religiao',   'igreja religião'),
  ('artes',      'arte contemporânea'),
  ('artes',      'museu exposição arte'),
  ('psicologia', 'psicologia saúde mental'),
  ('psicologia', 'terapia psicológica')
) AS q(slug, query)
JOIN public.themes t ON t.slug = q.slug;

-- ============ 3) INTEGRATION_CALLS (nunca semeada) ============
CREATE TABLE public.integration_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  http_status int,
  duration_ms int,
  ok boolean NOT NULL DEFAULT false,
  items_in int,
  items_new int,
  error text,
  called_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_calls_called_at_idx ON public.integration_calls(called_at DESC);
CREATE INDEX integration_calls_integration_idx ON public.integration_calls(integration, called_at DESC);
GRANT SELECT ON public.integration_calls TO authenticated;
GRANT ALL ON public.integration_calls TO service_role;
ALTER TABLE public.integration_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and moderators read integration calls" ON public.integration_calls FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- ============ 4) DEDUP + PROVENIÊNCIA em news ============
CREATE OR REPLACE FUNCTION public.canonical_url(u text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE base text; q text; parts text[]; kept text[] := '{}'; p text; k text;
BEGIN
  IF u IS NULL THEN RETURN NULL; END IF;
  u := btrim(u);
  u := split_part(u, '#', 1);
  base := split_part(u, '?', 1);
  q := CASE WHEN position('?' IN u) > 0 THEN substr(u, position('?' IN u) + 1) ELSE '' END;
  base := regexp_replace(base, '/+$', '');
  IF q <> '' THEN
    parts := string_to_array(q, '&');
    FOREACH p IN ARRAY parts LOOP
      IF p = '' THEN CONTINUE; END IF;
      k := lower(split_part(p, '=', 1));
      IF k LIKE 'utm\_%' OR k IN ('gclid', 'fbclid') THEN CONTINUE; END IF;
      kept := kept || p;
    END LOOP;
    IF array_length(kept, 1) > 0 THEN
      RETURN base || '?' || array_to_string(kept, '&');
    END IF;
  END IF;
  RETURN base;
END $$;

CREATE OR REPLACE FUNCTION public.url_hash(u text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(extensions.digest(convert_to(public.canonical_url(u), 'UTF8'), 'sha256'), 'hex');
$$;

ALTER TABLE public.news
  ADD COLUMN url_hash text,
  ADD COLUMN raw jsonb,
  ADD COLUMN status text NOT NULL DEFAULT 'publicada' CHECK (status IN ('publicada', 'arquivada'));

UPDATE public.news SET url_hash = public.url_hash(source_url);

ALTER TABLE public.news ALTER COLUMN url_hash SET NOT NULL;
ALTER TABLE public.news ADD CONSTRAINT news_url_hash_key UNIQUE (url_hash);
CREATE INDEX news_status_theme_published_idx ON public.news(status, theme_id, published_at DESC);

CREATE OR REPLACE FUNCTION public.set_news_url_hash()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.url_hash := public.url_hash(NEW.source_url);
  RETURN NEW;
END $$;
CREATE TRIGGER news_set_url_hash BEFORE INSERT OR UPDATE OF source_url ON public.news
  FOR EACH ROW EXECUTE FUNCTION public.set_news_url_hash();

-- ============ 5) NEWS_ANALYSIS ============
CREATE TABLE public.news_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL UNIQUE REFERENCES public.news(id) ON DELETE CASCADE,
  summary text,
  relevance int CHECK (relevance BETWEEN 0 AND 100),
  angle text,
  entities text[],
  sentiment text,
  is_relevant boolean,
  is_spam boolean,
  model text,
  prompt_version text,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_analysis TO anon, authenticated;
GRANT ALL ON public.news_analysis TO service_role;
ALTER TABLE public.news_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "News analysis is publicly readable" ON public.news_analysis FOR SELECT USING (true);

-- ============ 6f) APP_SETTINGS (domínios bloqueados editáveis) ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value, description) VALUES
  ('blocked_domains', '["a8n8m7.com"]'::jsonb, 'Domínios bloqueados após seguir o redirecionamento do Google News (lista que estava fixa no código).');

-- ============ 6g) news_refresh_control -> visão derivada de integration_calls ============
DROP TABLE public.news_refresh_control;
CREATE VIEW public.news_refresh_control
WITH (security_invoker = false) AS
  SELECT max(called_at) AS last_refresh_at
  FROM public.integration_calls
  WHERE integration = 'google_news_rss' AND ok = true;
GRANT SELECT ON public.news_refresh_control TO anon, authenticated, service_role;