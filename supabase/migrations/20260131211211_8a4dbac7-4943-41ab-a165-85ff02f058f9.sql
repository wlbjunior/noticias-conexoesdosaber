-- Create table for caching AI-generated hero images
CREATE TABLE public.hero_image_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_id UUID NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(news_id)
);

-- Enable RLS
ALTER TABLE public.hero_image_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached images (public news)
CREATE POLICY "Cached images are publicly readable"
ON public.hero_image_cache
FOR SELECT
USING (true);

-- Create index for fast lookups
CREATE INDEX idx_hero_image_cache_news_id ON public.hero_image_cache(news_id);