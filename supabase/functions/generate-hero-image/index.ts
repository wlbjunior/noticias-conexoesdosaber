import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, description, topic } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a visual prompt based on the news content and topic
    const topicStyles: Record<string, string> = {
      mitologia: 'mystical ancient Greek/Roman mythology scene, gods, temples, celestial atmosphere, dramatic lighting, ethereal clouds',
      filosofia: 'philosophical contemplation scene, ancient wisdom, books, scrolls, golden light, classical architecture, thoughtful atmosphere',
      religiao: 'spiritual religious scene, sacred architecture, divine light, peaceful atmosphere, stained glass, cathedral elements',
      artes: 'artistic creative scene, vibrant colors, museum gallery, sculptures, paintings, creative expression, artistic atmosphere',
      psicologia: 'abstract mind and psychology scene, neural connections, introspective atmosphere, balanced colors, mental wellness imagery',
    };

    const topicStyle = topicStyles[topic] || 'professional news journalism scene';
    
    // Build a rich prompt for image generation
    const imagePrompt = `Create a cinematic, high-quality editorial illustration for a news article about: "${title}". ${description ? `Context: ${description}.` : ''} Style: ${topicStyle}. Ultra high resolution, 16:9 aspect ratio hero image, professional photojournalism quality, dramatic lighting, rich colors.`;

    console.log('[generate-hero-image] Generating image with prompt:', imagePrompt);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: imagePrompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-hero-image] API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Image generation failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[generate-hero-image] Response received');

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('[generate-hero-image] No image URL in response');
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-hero-image] Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl, prompt: imagePrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[generate-hero-image] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
