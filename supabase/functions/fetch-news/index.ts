import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Topic = "mitologia" | "filosofia" | "religiao" | "artes" | "psicologia";

// Reduced to 2 queries per topic for performance
const topicQueries: Record<Topic, string[]> = {
  mitologia: ["mitologia grega", "mitologia nórdica"],
  filosofia: ["filosofia", "filósofos pensadores"],
  religiao: ["religião espiritualidade", "igreja religião"],
  artes: ["arte contemporânea", "museu exposição arte"],
  psicologia: ["psicologia saúde mental", "terapia psicológica"],
};

interface NewsArticle {
  topic: Topic;
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string;
  published_at: string;
  image_url: string | null;
}

function isSpamArticle(title: string, sourceName: string | null): boolean {
  const text = `${title} ${sourceName ?? ''}`.toLowerCase();
  
  // Lista de palavras-chave suspeitas
  const spamKeywords = [
    'bônus',
    'bonus',
    'ganhe crédito',
    'ganhe credito',
    'novo usuário',
    'novo usuario',
    'cadastro e ganhe',
    'cassino',
    'aposta esportiva',
    'apostas esportivas',
    'jogo de azar',
    'jogue agora',
  ];

  // Fontes frequentemente associadas a spam
  const suspiciousSources = [
    'prefeitura de cuiabá',
    'coren-df',
  ];

  // Check palavras-chave
  if (spamKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  // Check fontes suspeitas
  if (sourceName && suspiciousSources.some((source) => sourceName.toLowerCase().includes(source))) {
    console.log(`[NewsRefresh] Blocked suspicious source: ${sourceName}`);
    return true;
  }

  return false;
}

async function validateGoogleNewsUrl(googleUrl: string): Promise<boolean> {
  try {
    // Tenta seguir o redirect com timeout curto
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(googleUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Domínios bloqueados conhecidos
    const blockedDomains = ['a8n8m7.com', 'a8n8m7'];
    const finalUrl = response.url.toLowerCase();
    
    const isBlocked = blockedDomains.some((domain) => finalUrl.includes(domain));
    
    if (isBlocked) {
      console.log(`[NewsRefresh] Blocked redirect to: ${finalUrl}`);
    }
    
    return !isBlocked;
  } catch (error) {
    // Se timeout ou erro, aceita o link (evita bloquear conteúdo legítimo)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[NewsRefresh] Could not validate URL (accepting): ${errorMessage}`);
    return true;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function cleanHtml(html: string): string {
  if (!html) return '';
  let text = decodeHtmlEntities(html);
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(' ').filter(w => w.length > 3));
  const words2 = new Set(normalizeText(text2).split(' ').filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  if (articles.length <= 1) return articles;
  
  const SIMILARITY_THRESHOLD = 0.55;
  const selected: NewsArticle[] = [];
  const processed = new Set<number>();
  
  // Sort by date first (most recent first)
  articles.sort((a, b) => 
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
  
  for (let i = 0; i < articles.length; i++) {
    if (processed.has(i)) continue;
    
    const current = articles[i];
    selected.push(current);
    processed.add(i);
    
    // Only check next 15 articles for similarity (performance optimization)
    const checkLimit = Math.min(i + 15, articles.length);
    for (let j = i + 1; j < checkLimit; j++) {
      if (processed.has(j)) continue;
      
      const similarity = calculateSimilarity(current.title, articles[j].title);
      if (similarity >= SIMILARITY_THRESHOLD) {
        processed.add(j);
      }
    }
  }
  
  return selected;
}

function parseRssXml(xml: string, topic: Topic, maxItems: number = 20): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let count = 0;
  
  while ((match = itemRegex.exec(xml)) !== null && count < maxItems) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    let title = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
    
    const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
    const googleNewsLink = linkMatch ? linkMatch[1].trim() : null;
    
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1] : null;
    
    const sourceMatch = itemContent.match(/<source[^>]*>(.*?)<\/source>/);
    const sourceName = sourceMatch ? cleanHtml(sourceMatch[1]) : "Google News";
    
    if (title && googleNewsLink) {
      title = cleanHtml(title);
      const dashIndex = title.lastIndexOf(' - ');
      if (dashIndex > 0 && dashIndex > title.length * 0.5) {
        title = title.substring(0, dashIndex).trim();
      }

      if (isSpamArticle(title, sourceName)) {
        continue;
      }
      
      articles.push({
        topic,
        title,
        description: null,
        source_name: sourceName,
        source_url: googleNewsLink,
        published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        image_url: null,
      });
      count++;
    }
  }
  
  return articles;
}

async function fetchGoogleNewsRss(topic: Topic): Promise<NewsArticle[]> {
  const queries = topicQueries[topic];
  const allArticles: NewsArticle[] = [];
  
  for (const query of queries) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      
      console.log("[NewsRefresh] Fetching:", query);
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      });
      
      if (!response.ok) {
        console.error("[NewsRefresh] RSS failed:", response.status);
        continue;
      }
      
      const xml = await response.text();
      const articles = parseRssXml(xml, topic, 20); // Limit to 20 per query
      allArticles.push(...articles);
      
      console.log("[NewsRefresh] Found", articles.length, "for:", query);
    } catch (error) {
      console.error("[NewsRefresh] Error:", query, error);
    }
  }
  
  // Remove exact URL duplicates first
  const uniqueByUrl = allArticles.filter((article, index, self) =>
    index === self.findIndex(a => a.source_url === article.source_url)
  );
  
  console.log("[NewsRefresh] Unique URLs:", uniqueByUrl.length);
  
  // Deduplicate similar titles
  const deduplicated = deduplicateArticles(uniqueByUrl);
  
  console.log("[NewsRefresh] After dedup:", deduplicated.length);
  
  // Take top 10 per topic
  const topArticles = deduplicated.slice(0, 10);
  
  // Validate URLs (check redirects)
  console.log("[NewsRefresh] Validating URLs...");
  const validatedArticles: NewsArticle[] = [];
  
  for (const article of topArticles) {
    const isValid = await validateGoogleNewsUrl(article.source_url);
    if (isValid) {
      validatedArticles.push(article);
    }
  }
  
  console.log("[NewsRefresh] Valid articles after URL check:", validatedArticles.length);
  
  const topicDescriptions: Record<Topic, string> = {
    mitologia: "Notícia sobre mitologia e histórias dos deuses antigos.",
    filosofia: "Notícia sobre filosofia, pensadores e reflexões éticas.",
    religiao: "Notícia sobre religião, espiritualidade e fé.",
    artes: "Notícia sobre arte, cultura e expressões artísticas.",
    psicologia: "Notícia sobre psicologia, saúde mental e bem-estar.",
  };
  
  return validatedArticles.map(article => ({
    ...article,
    description: topicDescriptions[topic],
  }));
}

async function isRelevantArticleForTopic(article: NewsArticle, topic: Topic): Promise<{ isRelevant: boolean; rawAnswer: string | null }> {
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseKey) {
      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: restoredMatches, error: restoredError } = await adminClient
        .from("discarded_news")
        .select("id")
        .eq("source_url", article.source_url)
        .eq("restored", true)
        .limit(1);

      if (!restoredError && restoredMatches && restoredMatches.length > 0) {
        console.log("[NewsRefresh] Article previously restaurada manualmente, aceitando sem IA", {
          topic,
          title: article.title,
        });
        return { isRelevant: true, rawAnswer: "restored_by_admin" };
      }
    }

    if (!apiKey) {
      console.warn("[NewsRefresh] LOVABLE_API_KEY not configured, accepting article by default");
      return { isRelevant: true, rawAnswer: null };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você avalia se uma notícia está realmente relacionada a um tema específico (mitologia, filosofia, religião, artes ou psicologia). Responda apenas com uma palavra: 'relevante' ou 'irrelevante'. Seja rigoroso: se o tema principal parecer outro (ex.: esporte, política, celebridades), responda 'irrelevante'.",
          },
          {
            role: "user",
            content: `Tema: ${topic}\nTítulo: ${article.title}\nFonte: ${article.source_name ?? ""}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[NewsRefresh] AI relevance check failed", response.status, await response.text());
      return { isRelevant: true, rawAnswer: null }; // Em caso de falha da IA, não bloquear notícia
    }

    const data = await response.json();
    const rawContent: string | null = (data?.choices?.[0]?.message?.content as string | undefined) ?? null;
    const answer = rawContent?.toLowerCase().trim() ?? "";

    const isRelevant = answer.startsWith("relevante");
    if (!isRelevant) {
      console.log("[NewsRefresh] AI marked article as irrelevant", { topic, title: article.title, answer });
    }

    return { isRelevant, rawAnswer: rawContent };
  } catch (error) {
    console.error("[NewsRefresh] Error in AI relevance check", error);
    return { isRelevant: true, rawAnswer: null }; // Em erro inesperado, mantemos notícia
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Note: This function is rate-limited by cron schedule and only performs safe read/write operations
  // No authentication required as it only fetches public news and stores in database

  try {
    console.log("[NewsRefresh] Started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const topics: Topic[] = ["mitologia", "filosofia", "religiao", "artes", "psicologia"];
    
    for (const topic of topics) {
      const articles = await fetchGoogleNewsRss(topic);
      
      await supabase.from("news").delete().eq("topic", topic);

      let added = 0;
      for (const article of articles) {
        const { isRelevant, rawAnswer } = await isRelevantArticleForTopic(article, topic);
        if (!isRelevant) {
          const { error: discardError } = await supabase
            .from("discarded_news")
            .insert({
              topic: article.topic,
              title: article.title,
              description: article.description,
              source_name: article.source_name,
              source_url: article.source_url,
              published_at: article.published_at,
              reason: "Marcada como irrelevante pela IA para o tema",
              ai_raw_answer: rawAnswer,
            });

          if (discardError) {
            console.error("[NewsRefresh] Error inserting into discarded_news:", discardError);
          }

          continue;
        }

        const { error } = await supabase
          .from("news")
          .upsert({ ...article, fetched_at: new Date().toISOString() }, { onConflict: "source_url" });

        if (!error) added++;
        else console.error("[NewsRefresh] Insert error:", error);
      }

      console.log("[NewsRefresh] Updated", topic, ":", added, "articles (after AI relevance filter)");
    }

    await supabase
      .from("news_refresh_control")
      .update({ last_refresh_at: new Date().toISOString() })
      .not("id", "is", null);

    console.log("[NewsRefresh] Completed");

    return new Response(
      JSON.stringify({ success: true, message: "News refreshed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NewsRefresh] Error", error);
    return new Response(
      JSON.stringify({ error: "Failed to refresh news" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
