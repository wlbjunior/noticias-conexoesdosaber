CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_status AS ENUM (
    'novo',
    'em_analise',
    'respondido'
);


--
-- Name: news_topic; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.news_topic AS ENUM (
    'mitologia',
    'filosofia',
    'religiao',
    'artes',
    'psicologia'
);


--
-- Name: cleanup_old_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_rate_limits() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.newsletter_rate_limits 
  WHERE last_attempt_at < NOW() - INTERVAL '1 hour';
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    type text NOT NULL,
    subject text,
    message text NOT NULL,
    status public.message_status DEFAULT 'novo'::public.message_status NOT NULL,
    CONSTRAINT contact_messages_type_check CHECK ((type = ANY (ARRAY['contato'::text, 'parceria'::text])))
);


--
-- Name: discarded_news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discarded_news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic public.news_topic NOT NULL,
    title text NOT NULL,
    description text,
    source_name text,
    source_url text NOT NULL,
    published_at timestamp with time zone NOT NULL,
    discarded_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    ai_raw_answer text,
    restored boolean DEFAULT false NOT NULL
);


--
-- Name: internal_news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    author_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    status text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    topic public.news_topic DEFAULT 'mitologia'::public.news_topic NOT NULL,
    CONSTRAINT internal_news_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'publicado'::text, 'arquivado'::text])))
);


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic public.news_topic NOT NULL,
    title text NOT NULL,
    description text,
    source_name text,
    source_url text NOT NULL,
    full_article_url text,
    published_at timestamp with time zone NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: news_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id uuid NOT NULL,
    topic text NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: news_refresh_control; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_refresh_control (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    last_refresh_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: newsletter_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_hash text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    first_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: newsletter_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    topics public.news_topic[] DEFAULT ARRAY['mitologia'::public.news_topic, 'filosofia'::public.news_topic, 'religiao'::public.news_topic, 'artes'::public.news_topic, 'psicologia'::public.news_topic] NOT NULL,
    confirmed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_sent_at timestamp with time zone,
    unsubscribe_token uuid DEFAULT gen_random_uuid()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: discarded_news discarded_news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discarded_news
    ADD CONSTRAINT discarded_news_pkey PRIMARY KEY (id);


--
-- Name: internal_news internal_news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_news
    ADD CONSTRAINT internal_news_pkey PRIMARY KEY (id);


--
-- Name: news_clicks news_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_clicks
    ADD CONSTRAINT news_clicks_pkey PRIMARY KEY (id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news_refresh_control news_refresh_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_refresh_control
    ADD CONSTRAINT news_refresh_control_pkey PRIMARY KEY (id);


--
-- Name: news news_source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_source_url_key UNIQUE (source_url);


--
-- Name: newsletter_rate_limits newsletter_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_rate_limits
    ADD CONSTRAINT newsletter_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscriptions newsletter_subscriptions_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_email_key UNIQUE (email);


--
-- Name: newsletter_subscriptions newsletter_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscriptions
    ADD CONSTRAINT newsletter_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_news_clicks_clicked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_clicks_clicked_at ON public.news_clicks USING btree (clicked_at);


--
-- Name: idx_news_clicks_news_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_clicks_news_id ON public.news_clicks USING btree (news_id);


--
-- Name: idx_news_clicks_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_clicks_topic ON public.news_clicks USING btree (topic);


--
-- Name: idx_news_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_published_at ON public.news USING btree (published_at DESC);


--
-- Name: idx_news_topic_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_topic_published ON public.news USING btree (topic, published_at DESC);


--
-- Name: idx_newsletter_subscriptions_last_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_subscriptions_last_sent ON public.newsletter_subscriptions USING btree (last_sent_at);


--
-- Name: idx_rate_limits_ip_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_rate_limits_ip_hash ON public.newsletter_rate_limits USING btree (ip_hash);


--
-- Name: contact_messages contact_messages_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contact_messages_set_updated_at BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: internal_news internal_news_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER internal_news_set_updated_at BEFORE UPDATE ON public.internal_news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: newsletter_subscriptions update_newsletter_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_newsletter_subscriptions_updated_at BEFORE UPDATE ON public.newsletter_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: internal_news internal_news_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_news
    ADD CONSTRAINT internal_news_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: news_clicks news_clicks_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_clicks
    ADD CONSTRAINT news_clicks_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admin email can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin email can manage roles" ON public.user_roles TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'wlbjunior@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'wlbjunior@gmail.com'::text));


--
-- Name: news Admins manage news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage news" ON public.news TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_messages Anyone can create contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create contact messages" ON public.contact_messages FOR INSERT WITH CHECK (true);


--
-- Name: news_clicks Anyone can insert clicks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert clicks" ON public.news_clicks FOR INSERT WITH CHECK (true);


--
-- Name: news_clicks Anyone can read click statistics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read click statistics" ON public.news_clicks FOR SELECT USING (true);


--
-- Name: newsletter_subscriptions Anyone can subscribe to newsletter; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions FOR INSERT WITH CHECK (true);


--
-- Name: news News is publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "News is publicly readable" ON public.news FOR SELECT USING (true);


--
-- Name: newsletter_rate_limits No public access to rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No public access to rate limits" ON public.newsletter_rate_limits USING (false);


--
-- Name: newsletter_subscriptions No public reads on newsletter_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No public reads on newsletter_subscriptions" ON public.newsletter_subscriptions FOR SELECT USING (false);


--
-- Name: contact_messages Only admins can read contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can read contact messages" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contact_messages Only admins can update contact messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update contact messages" ON public.contact_messages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: discarded_news Only admins manage discarded news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins manage discarded news" ON public.discarded_news TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: internal_news Only admins manage internal news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins manage internal news" ON public.internal_news TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: internal_news Public can read published internal news; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read published internal news" ON public.internal_news FOR SELECT USING ((status = 'publicado'::text));


--
-- Name: news_refresh_control Refresh control is publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Refresh control is publicly readable" ON public.news_refresh_control FOR SELECT USING (true);


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: discarded_news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discarded_news ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_news ENABLE ROW LEVEL SECURITY;

--
-- Name: news; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

--
-- Name: news_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: news_refresh_control; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.news_refresh_control ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;