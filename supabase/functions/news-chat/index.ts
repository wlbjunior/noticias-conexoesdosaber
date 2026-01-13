import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages }: ChatRequest = await req.json();
    console.log("[NewsChat] Received request with", messages.length, "messages");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch recent news for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: recentNews } = await supabase
      .from("news")
      .select("title, topic, description, source_name, source_url, published_at")
      .order("published_at", { ascending: false })
      .limit(10);

    const newsContext = recentNews
      ?.map((n) =>
        `- [${n.topic}] ${n.title} (${n.source_name}, ${new Date(n.published_at).toLocaleDateString("pt-BR")})\n  Fonte: ${n.source_url}`,
      )
      .join("\n\n") || "Nenhuma notícia disponível no momento.";

    const systemPrompt = `Você é o assistente do portal "Notícias Temáticas", especializado EXCLUSIVAMENTE em ajudar usuários a encontrar e entender as notícias disponíveis no site.

NOTÍCIAS DISPONÍVEIS NO SITE AGORA:
${newsContext}

REGRAS IMPORTANTES:
1. Você SOMENTE pode responder sobre as notícias listadas acima
2. Se perguntarem sobre algo que NÃO está nas notícias acima, diga educadamente que não há notícias sobre esse assunto no momento
3. Ajude os usuários a:
   - Encontrar notícias por tema (Mitologia, Filosofia, Religião, Artes, Psicologia)
   - Resumir ou explicar o conteúdo das notícias existentes
   - Recomendar notícias com base nos interesses do usuário
4. Se perguntarem sobre assuntos gerais NÃO relacionados às notícias, redirecione gentilmente: "Posso ajudar apenas com as notícias do nosso portal. Temos notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia. Sobre qual tema gostaria de saber?"
5. NUNCA invente notícias ou informações que não estão na lista acima
6. Seja amigável, use português brasileiro e mantenha respostas concisas (máximo 150 palavras)
7. SEMPRE que mencionar uma notícia específica, inclua também a frase "Leia mais em:" seguida do link da fonte correspondente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[NewsChat] AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Serviço temporariamente indisponível." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    console.log("[NewsChat] Response generated successfully");

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NewsChat] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar sua pergunta." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
