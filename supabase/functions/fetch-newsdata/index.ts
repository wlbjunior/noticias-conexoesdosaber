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
    const NEWSDATA_API_KEY = Deno.env.get('NEWSDATA_API_KEY');

    if (!NEWSDATA_API_KEY) {
      throw new Error('NEWSDATA_API_KEY not configured');
    }

    console.log('[NewsData] Fetching news', { query, topic });

    const url = new URL('https://newsdata.io/api/1/news');
    url.searchParams.append('apikey', NEWSDATA_API_KEY);
    url.searchParams.append('q', query);
    url.searchParams.append('language', 'pt');
    url.searchParams.append('size', '10');

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[NewsData] API error:', response.status, errorText);
      throw new Error(`NewsData API error: ${response.status}`);
    }

    const data = await response.json();

    // Normalize response to match our NewsItem structure
    const normalizedNews = data.results?.map((article: any) => ({
      title: article.title,
      description: article.description,
      source_name: article.source_id,
      source_url: article.link,
      full_article_url: article.link,
      image_url: article.image_url,
      published_at: article.pubDate,
      topic: topic || 'filosofia', // Default topic or provided
    })) || [];

    console.log('[NewsData] Success', { count: normalizedNews.length });

    return new Response(JSON.stringify({ news: normalizedNews }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[NewsData] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
