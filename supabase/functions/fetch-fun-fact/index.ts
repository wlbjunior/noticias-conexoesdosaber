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
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');

    if (!RAPIDAPI_KEY) {
      throw new Error('RAPIDAPI_KEY not configured');
    }

    console.log('[FunFact] Fetching daily fun fact from API-Ninjas');

    // Using API-Ninjas Facts API which is more reliable
    const response = await fetch('https://api.api-ninjas.com/v1/facts?limit=1', {
      method: 'GET',
      headers: {
        'X-Api-Key': RAPIDAPI_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FunFact] API error:', response.status, errorText);
      
      // Fallback: try using a simple facts endpoint
      console.log('[FunFact] Trying fallback...');
      
      const fallbackResponse = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log('[FunFact] Fallback success', fallbackData);
        
        return new Response(JSON.stringify({ 
          fact: { 
            fact: fallbackData.text,
            source: fallbackData.source || 'uselessfacts.jsph.pl'
          } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`FunFact API error: ${response.status}`);
    }

    const data = await response.json();
    
    // API-Ninjas returns an array of facts
    const factText = Array.isArray(data) && data.length > 0 ? data[0].fact : data.fact || data;

    console.log('[FunFact] Success', factText);

    return new Response(JSON.stringify({ 
      fact: { 
        fact: factText,
        source: 'api-ninjas.com'
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[FunFact] Error:', error);
    
    // Final fallback with a static interesting fact
    const staticFacts = [
      "Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible.",
      "Octopuses have three hearts and blue blood.",
      "The shortest war in history lasted only 38 to 45 minutes between Britain and Zanzibar.",
      "A group of flamingos is called a 'flamboyance'.",
      "The Eiffel Tower can grow by up to 6 inches during summer due to thermal expansion."
    ];
    
    const randomFact = staticFacts[Math.floor(Math.random() * staticFacts.length)];
    
    return new Response(JSON.stringify({ 
      fact: { 
        fact: randomFact,
        source: 'static-fallback'
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
