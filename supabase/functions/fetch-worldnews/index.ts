import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, topic } = await req.json();
    const WORLDNEWS_API_KEY = Deno.env.get('WORLDNEWS_API_KEY');

    if (!WORLDNEWS_API_KEY) {
      throw new Error('WORLDNEWS_API_KEY not configured');
    }

    console.log('[WorldNews] Fetching news', { query, topic });

    const url = new URL('https://api.worldnewsapi.com/search-news');
    url.searchParams.append('api-key', WORLDNEWS_API_KEY);
    url.searchParams.append('text', query);
    url.searchParams.append('language', 'pt');
    url.searchParams.append('number', '10');
    url.searchParams.append('sort', 'publish-time');
    url.searchParams.append('sort-direction', 'DESC');

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WorldNews] API error:', response.status, errorText);
      throw new Error(`WorldNews API error: ${response.status}`);
    }

    const data = await response.json();

    // Normalize response to match our NewsItem structure
    const normalizedNews = data.news?.map((article: any) => ({
      title: article.title,
      description: article.text,
      source_name: article.source_country,
      source_url: article.url,
      full_article_url: article.url,
      image_url: article.image,
      published_at: article.publish_date,
      topic: topic || 'filosofia',
    })) || [];

    console.log('[WorldNews] Success', { count: normalizedNews.length });

    return new Response(JSON.stringify({ news: normalizedNews }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[WorldNews] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
