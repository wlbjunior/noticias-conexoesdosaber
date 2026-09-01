import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ------------------------------------------------------------------
// Configuração
// ------------------------------------------------------------------
const PUBLISHED_PER_THEME = 10; // quantas ficam "publicada" por tema
const CANDIDATES_PER_THEME = 12; // quantas candidatas novas tentamos por rodada
const ARCHIVE_RETENTION_DAYS = 90;
const AI_MODEL = "google/gemini-2.5-flash";
const PROMPT_VERSION = "v1";
const AI_MAX_RETRIES = 3;
const REDIRECT_TIMEOUT_MS = 2500;
const RSS_TIMEOUT_MS = 10000;

const LOG = "[fetch-news]";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ------------------------------------------------------------------
// Tipos
// ------------------------------------------------------------------
interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface Source {
  id: string;
  theme_id: string;
  kind: string;
  name: string;
  query: string;
  max_items: number;
  consecutive_failures: number;
}

interface Candidate {
  theme_id: string;
  topic: string;
  title: string;
  source_name: string | null;
  source_url: string;
  published_at: string;
  raw: Record<string, string | null>;
}

interface AnalysisResult {
  id: string;
  resumo: string | null;
  relevancia: number | null;
  angulo: string | null;
  entidades: string[];
  sentimento: string | null;
  relevante: boolean;
  spam: boolean;
}

interface IntegrationCall {
  integration: string;
  endpoint: string;
  method?: string;
  http_status?: number | null;
  duration_ms: number;
  ok: boolean;
  items_in?: number | null;
  items_new?: number | null;
  error?: string | null;
}

// ------------------------------------------------------------------
// Telemetria — só grava após uma requisição HTTP real
// ------------------------------------------------------------------
async function logCall(db: SupabaseClient, call: IntegrationCall) {
  const { error } = await db.from("integration_calls").insert({
    integration: call.integration,
    endpoint: call.endpoint,
    method: call.method ?? "GET",
    http_status: call.http_status ?? null,
    duration_ms: call.duration_ms,
    ok: call.ok,
    items_in: call.items_in ?? null,
    items_new: call.items_new ?? null,
    error: call.error ? call.error.slice(0, 2000) : null,
  });
  if (error) console.error(LOG, "integration_calls insert failed:", error.message);
}

async function updateSourceHealth(db: SupabaseClient, source: Source, ok: boolean, errorMsg?: string) {
  const { error } = await db
    .from("sources")
    .update({
      last_run_at: new Date().toISOString(),
      last_status: ok ? "ok" : "erro",
      last_error: ok ? null : (errorMsg ?? "erro desconhecido").slice(0, 1000),
      consecutive_failures: ok ? 0 : source.consecutive_failures + 1,
    })
    .eq("id", source.id);
  if (error) console.error(LOG, "sources update failed:", error.message);
}

// ------------------------------------------------------------------
// Texto / HTML
// ------------------------------------------------------------------
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Remove tags (inclusive tag truncada no fim), decodifica entidades e normaliza espaços. */
function cleanHtml(html: string | null | undefined): string {
  if (!html) return "";
  let text = html.replace(/<!\[CDATA\[|\]\]>/g, "");
  text = text.replace(/<[^>]*>/g, "");
  text = decodeHtmlEntities(text);
  text = text.replace(/<[^>]*>/g, "").replace(/<[^>]*$/, "");
  return text.replace(/\s+/g, " ").trim();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const wa = new Set(normalizeText(a).split(" ").filter((w) => w.length > 3));
  const wb = new Set(normalizeText(b).split(" ").filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return inter / union;
}

/** Espelha public.canonical_url() no banco. */
function canonicalUrl(input: string): string {
  let u = input.trim();
  u = u.split("#")[0];
  const qIndex = u.indexOf("?");
  let base = qIndex >= 0 ? u.slice(0, qIndex) : u;
  const q = qIndex >= 0 ? u.slice(qIndex + 1) : "";
  base = base.replace(/\/+$/, "");
  if (q) {
    const kept = q.split("&").filter((p) => {
      if (!p) return false;
      const k = p.split("=")[0].toLowerCase();
      return !(k.startsWith("utm_") || k === "gclid" || k === "fbclid");
    });
    if (kept.length) return `${base}?${kept.join("&")}`;
  }
  return base;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------------
// Anti-spam por palavras-chave (primeira barreira, barata)
// ------------------------------------------------------------------
const SPAM_KEYWORDS = [
  "bônus", "bonus", "ganhe crédito", "ganhe credito", "novo usuário", "novo usuario",
  "cadastro e ganhe", "cassino", "casino", "aposta esportiva", "apostas esportivas",
  "jogo de azar", "jogue agora", "slot", "gates of olympus", "fortune tiger", "bet365", "betano",
  "rodadas grátis", "rodadas gratis", "código promocional", "codigo promocional",
];
const SUSPICIOUS_SOURCES = ["prefeitura de cuiabá", "coren-df"];

function keywordSpamReason(title: string, sourceName: string | null): string | null {
  const text = `${title} ${sourceName ?? ""}`.toLowerCase();
  const kw = SPAM_KEYWORDS.find((k) => text.includes(k));
  if (kw) return `palavra-chave de spam: "${kw}"`;
  if (sourceName) {
    const src = SUSPICIOUS_SOURCES.find((s) => sourceName.toLowerCase().includes(s));
    if (src) return `fonte suspeita: "${src}"`;
  }
  return null;
}

// ------------------------------------------------------------------
// RSS
// ------------------------------------------------------------------
function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/["']/g, "");
  if (fromHeader) return fromHeader.toLowerCase();
  const ascii = new TextDecoder("ascii").decode(head.subarray(0, 300));
  const fromXml = ascii.match(/encoding=["']([^"']+)["']/i)?.[1];
  return (fromXml ?? "utf-8").toLowerCase();
}

function decodeBody(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function extract(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function parseRss(xml: string, theme: Theme, maxItems: number): { candidates: Candidate[]; parsed: number } {
  const candidates: Candidate[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  let parsed = 0;

  while ((match = itemRegex.exec(xml)) !== null && candidates.length < maxItems) {
    parsed++;
    const item = match[1];
    const rawTitle = extract(item, "title");
    const rawLink = extract(item, "link");
    const rawPubDate = extract(item, "pubDate");
    const rawSource = extract(item, "source");
    const rawDescription = extract(item, "description");

    if (!rawTitle || !rawLink) continue;

    let title = cleanHtml(rawTitle);
    const dashIndex = title.lastIndexOf(" - ");
    if (dashIndex > 0 && dashIndex > title.length * 0.5) title = title.slice(0, dashIndex).trim();
    if (!title) continue;

    const link = cleanHtml(rawLink);
    if (!/^https?:\/\//i.test(link)) continue;

    const sourceName = rawSource ? cleanHtml(rawSource) : "Google News";
    const pub = rawPubDate ? new Date(rawPubDate) : null;
    const publishedAt = pub && !isNaN(pub.getTime()) ? pub.toISOString() : new Date().toISOString();

    candidates.push({
      theme_id: theme.id,
      topic: theme.slug,
      title,
      source_name: sourceName,
      source_url: link,
      published_at: publishedAt,
      raw: {
        title: rawTitle,
        link: rawLink,
        pubDate: rawPubDate,
        source: rawSource,
        description: rawDescription ? rawDescription.slice(0, 2000) : null,
      },
    });
  }
  return { candidates, parsed };
}

async function fetchSource(db: SupabaseClient, source: Source, theme: Theme): Promise<Candidate[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(source.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const started = Date.now();
  let status: number | null = null;

  try {
    let res: Response | null = null;
    // Google News às vezes responde 503 transitório: até 3 tentativas com backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
      res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        signal: controller.signal,
      });
      clearTimeout(t);
      if (res.ok || (res.status !== 503 && res.status !== 429) || attempt === 3) break;
      console.warn(LOG, `RSS "${source.query}" HTTP ${res.status}, tentativa ${attempt}`);
      await sleep(1500 * attempt);
    }
    if (!res) throw new Error("sem resposta");
    status = res.status;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const duration = Date.now() - started;

    if (!res.ok) {
      const err = `HTTP ${res.status}`;
      await logCall(db, { integration: "google_news_rss", endpoint: url, http_status: status, duration_ms: duration, ok: false, error: err });
      await updateSourceHealth(db, source, false, err);
      return [];
    }

    const xml = decodeBody(bytes, detectCharset(res.headers.get("content-type"), bytes));
    const { candidates, parsed } = parseRss(xml, theme, source.max_items);

    await logCall(db, { integration: "google_news_rss", endpoint: url, http_status: status, duration_ms: duration, ok: true, items_in: parsed });
    await updateSourceHealth(db, source, true);
    console.log(LOG, `RSS "${source.query}": ${parsed} itens, ${candidates.length} válidos`);
    return candidates;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await logCall(db, { integration: "google_news_rss", endpoint: url, http_status: status, duration_ms: Date.now() - started, ok: false, error: err });
    await updateSourceHealth(db, source, false, err);
    console.error(LOG, `RSS "${source.query}" falhou:`, err);
    return [];
  }
}

// ------------------------------------------------------------------
// Validação de redirect (domínios bloqueados vêm de app_settings)
// ------------------------------------------------------------------
async function resolvesToBlockedDomain(url: string, blocked: string[]): Promise<boolean> {
  if (blocked.length === 0) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    clearTimeout(t);
    const finalUrl = res.url.toLowerCase();
    return blocked.some((d) => finalUrl.includes(d.toLowerCase()));
  } catch {
    return false; // em dúvida, não bloqueia conteúdo legítimo
  }
}

// ------------------------------------------------------------------
// IA — 1 chamada por tema, tool calling, retry com backoff
// ------------------------------------------------------------------
const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "registrar_analises",
    description: "Registra a análise editorial de cada notícia recebida.",
    parameters: {
      type: "object",
      properties: {
        analises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "id exatamente como recebido" },
              resumo: { type: "string", description: "Resumo factual em PT-BR, 1-2 frases, baseado só no título/fonte. Se não for possível, string vazia." },
              relevancia: { type: "integer", minimum: 0, maximum: 100 },
              angulo: { type: "string", description: "Ângulo editorial em poucas palavras" },
              entidades: { type: "array", items: { type: "string" } },
              sentimento: { type: "string", enum: ["positivo", "neutro", "negativo"] },
              relevante: { type: "boolean", description: "true se o tema principal é realmente o tema indicado" },
              spam: { type: "boolean", description: "true se for propaganda, apostas, cassino, promoção, conteúdo enganoso ou sem valor jornalístico" },
            },
            required: ["id", "relevante", "spam"],
            additionalProperties: false,
          },
        },
      },
      required: ["analises"],
      additionalProperties: false,
    },
  },
};

async function analyzeBatch(
  db: SupabaseClient,
  theme: Theme,
  items: { id: string; title: string; source_name: string | null }[],
): Promise<AnalysisResult[] | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn(LOG, "LOVABLE_API_KEY ausente — itens ficam retidos sem análise");
    return null;
  }

  const systemPrompt =
    `Você é editor do Boletim Conexões do Saber, um portal de humanidades. ` +
    `Avalie cada notícia para o tema "${theme.name}" (${theme.description ?? ""}). ` +
    `Seja rigoroso: se o assunto principal for outro (esporte, política partidária, celebridades, jogos de azar, promoções), marque relevante=false. ` +
    `Marque spam=true para apostas, cassinos, bônus, cupons, conteúdo patrocinado ou sem valor jornalístico. ` +
    `O resumo deve ser factual e derivado apenas do título e fonte — nunca invente fatos; se não houver base, deixe vazio. ` +
    `Responda SOMENTE chamando a ferramenta registrar_analises, incluindo TODOS os ids recebidos.`;

  const userPrompt = items.map((i) => `id: ${i.id}\ntítulo: ${i.title}\nfonte: ${i.source_name ?? "desconhecida"}`).join("\n\n");

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [ANALYSIS_TOOL],
          tool_choice: { type: "function", function: { name: "registrar_analises" } },
        }),
      });
      status = res.status;
      const duration = Date.now() - started;

      if (!res.ok) {
        const body = await res.text();
        await logCall(db, { integration: "lovable_ai", endpoint: `chat/completions#${theme.slug}`, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: body.slice(0, 500) });
        if ((status === 429 || status >= 500) && attempt < AI_MAX_RETRIES) {
          const wait = 2000 * 2 ** (attempt - 1);
          console.warn(LOG, `IA ${status} (tema ${theme.slug}), tentativa ${attempt}, aguardando ${wait}ms`);
          await sleep(wait);
          continue;
        }
        console.error(LOG, `IA falhou definitivamente para ${theme.slug}: ${status}`);
        return null;
      }

      const data = await res.json();
      const call = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) {
        await logCall(db, { integration: "lovable_ai", endpoint: `chat/completions#${theme.slug}`, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: "resposta sem tool_call" });
        return null;
      }

      let parsed: { analises?: unknown[] };
      try {
        parsed = JSON.parse(call.function.arguments);
      } catch (e) {
        await logCall(db, { integration: "lovable_ai", endpoint: `chat/completions#${theme.slug}`, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: `JSON inválido: ${String(e)}` });
        return null;
      }

      const validIds = new Set(items.map((i) => i.id));
      const results: AnalysisResult[] = [];
      for (const a of parsed.analises ?? []) {
        const r = a as Record<string, unknown>;
        if (typeof r.id !== "string" || !validIds.has(r.id)) continue;
        results.push({
          id: r.id,
          resumo: typeof r.resumo === "string" && r.resumo.trim() ? r.resumo.trim().slice(0, 600) : null,
          relevancia: typeof r.relevancia === "number" ? Math.max(0, Math.min(100, Math.round(r.relevancia))) : null,
          angulo: typeof r.angulo === "string" && r.angulo.trim() ? r.angulo.trim().slice(0, 200) : null,
          entidades: Array.isArray(r.entidades) ? r.entidades.filter((e): e is string => typeof e === "string").slice(0, 10) : [],
          sentimento: typeof r.sentimento === "string" ? r.sentimento : null,
          relevante: r.relevante === true,
          spam: r.spam === true,
        });
      }

      await logCall(db, { integration: "lovable_ai", endpoint: `chat/completions#${theme.slug}`, method: "POST", http_status: status, duration_ms: duration, ok: true, items_in: items.length, items_new: results.length });
      console.log(LOG, `IA ${theme.slug}: ${results.length}/${items.length} analisadas`);
      return results;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logCall(db, { integration: "lovable_ai", endpoint: `chat/completions#${theme.slug}`, method: "POST", http_status: status, duration_ms: Date.now() - started, ok: false, items_in: items.length, error: err });
      if (attempt < AI_MAX_RETRIES) {
        await sleep(2000 * 2 ** (attempt - 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ------------------------------------------------------------------
// Descarte (vai para discarded_news e sai de news)
// ------------------------------------------------------------------
async function discardNews(
  db: SupabaseClient,
  row: { id?: string; theme_id: string; topic: string; title: string; description?: string | null; source_name: string | null; source_url: string; published_at: string },
  reason: string,
  aiRaw: string | null,
) {
  const { error } = await db.from("discarded_news").insert({
    theme_id: row.theme_id,
    topic: row.topic,
    title: row.title,
    description: row.description ?? null,
    source_name: row.source_name,
    source_url: row.source_url,
    published_at: row.published_at,
    reason,
    ai_raw_answer: aiRaw,
  });
  if (error) console.error(LOG, "discarded_news insert failed:", error.message);
  if (row.id) {
    const { error: delErr } = await db.from("news").delete().eq("id", row.id);
    if (delErr) console.error(LOG, "news delete failed:", delErr.message);
  }
}

// ------------------------------------------------------------------
// Processamento por tema
// ------------------------------------------------------------------
async function processTheme(db: SupabaseClient, theme: Theme, sources: Source[], blockedDomains: string[]) {
  console.log(LOG, `=== Tema ${theme.slug} (${sources.length} fontes) ===`);

  // 1) Coleta
  let collected: Candidate[] = [];
  for (const source of sources) {
    collected.push(...(await fetchSource(db, source, theme)));
  }
  if (collected.length === 0) {
    console.warn(LOG, `Nenhum item coletado para ${theme.slug}`);
    return;
  }

  // 2) Dedup intra-lote (URL canônica + títulos parecidos), mais recentes primeiro
  const seenHash = new Set<string>();
  const uniqueByUrl: Candidate[] = [];
  for (const c of collected) {
    const h = await sha256Hex(canonicalUrl(c.source_url));
    if (seenHash.has(h)) continue;
    seenHash.add(h);
    uniqueByUrl.push(c);
  }
  uniqueByUrl.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  const deduped: Candidate[] = [];
  for (const c of uniqueByUrl) {
    if (!deduped.some((d) => titleSimilarity(d.title, c.title) >= 0.55)) deduped.push(c);
  }
  collected = deduped;

  // 3) Ignora o que já conhecemos (news por hash; discarded_news não restauradas por URL)
  const hashes = await Promise.all(collected.map((c) => sha256Hex(canonicalUrl(c.source_url))));
  const { data: known } = await db.from("news").select("url_hash").in("url_hash", hashes);
  const knownHashes = new Set((known ?? []).map((k: { url_hash: string }) => k.url_hash));
  const { data: discarded } = await db
    .from("discarded_news")
    .select("source_url, restored")
    .in("source_url", collected.map((c) => c.source_url));
  const alreadyDiscarded = new Set((discarded ?? []).filter((d: { restored: boolean }) => !d.restored).map((d: { source_url: string }) => d.source_url));
  const restoredByAdmin = new Set((discarded ?? []).filter((d: { restored: boolean }) => d.restored).map((d: { source_url: string }) => d.source_url));

  let fresh = collected.filter((c, i) => !knownHashes.has(hashes[i]) && !alreadyDiscarded.has(c.source_url));
  console.log(LOG, `${theme.slug}: ${collected.length} únicas, ${fresh.length} inéditas`);

  // 4) Barreira barata: palavras-chave + redirect para domínio bloqueado
  const passed: Candidate[] = [];
  for (const c of fresh) {
    const kwReason = keywordSpamReason(c.title, c.source_name);
    if (kwReason) {
      await discardNews(db, c, `Spam (${kwReason})`, null);
      continue;
    }
    passed.push(c);
  }
  fresh = passed.slice(0, CANDIDATES_PER_THEME);

  const redirectChecks = await Promise.all(fresh.map((c) => resolvesToBlockedDomain(c.source_url, blockedDomains)));
  const toInsert: Candidate[] = [];
  for (let i = 0; i < fresh.length; i++) {
    if (redirectChecks[i]) {
      await discardNews(db, fresh[i], "Redireciona para domínio bloqueado", null);
    } else {
      toInsert.push(fresh[i]);
    }
  }

  // 5) Insere como arquivada (ON CONFLICT DO NOTHING via url_hash calculado pelo gatilho)
  let inserted: { id: string; title: string; source_name: string | null; source_url: string; published_at: string }[] = [];
  if (toInsert.length > 0) {
    const { data, error } = await db
      .from("news")
      .upsert(
        toInsert.map((c) => ({
          theme_id: c.theme_id,
          topic: c.topic,
          title: c.title,
          description: null,
          source_name: c.source_name,
          source_url: c.source_url,
          published_at: c.published_at,
          fetched_at: new Date().toISOString(),
          image_url: null,
          raw: c.raw,
          status: "arquivada",
        })),
        { onConflict: "url_hash", ignoreDuplicates: true },
      )
      .select("id, title, source_name, source_url, published_at");
    if (error) {
      console.error(LOG, `Insert em news falhou (${theme.slug}):`, error.message);
    } else {
      inserted = data ?? [];
    }
  }
  console.log(LOG, `${theme.slug}: ${inserted.length} novas inseridas`);

  // Restauradas manualmente pelo admin: publicam sem passar pela IA
  const restoredNow = inserted.filter((r) => restoredByAdmin.has(r.source_url));
  if (restoredNow.length) {
    await db.from("news").update({ status: "publicada" }).in("id", restoredNow.map((r) => r.id));
  }

  // 6) IA em lote: novas + publicadas antigas ainda sem análise (backfill)
  const { data: unanalyzed } = await db
    .from("news")
    .select("id, title, source_name, source_url, published_at, news_analysis(id)")
    .eq("theme_id", theme.id)
    .eq("status", "publicada")
    .is("news_analysis", null)
    .order("published_at", { ascending: false })
    .limit(20);

  const toAnalyzeMap = new Map<string, { id: string; title: string; source_name: string | null; source_url: string; published_at: string }>();
  for (const r of inserted) if (!restoredByAdmin.has(r.source_url)) toAnalyzeMap.set(r.id, r);
  for (const r of unanalyzed ?? []) toAnalyzeMap.set(r.id, r);
  const toAnalyze = [...toAnalyzeMap.values()];

  if (toAnalyze.length > 0) {
    const results = await analyzeBatch(db, theme, toAnalyze);
    if (results) {
      const byId = new Map(results.map((r) => [r.id, r]));
      for (const item of toAnalyze) {
        const r = byId.get(item.id);
        if (!r) {
          console.warn(LOG, `Item sem análise retornada (fica retido): ${item.title}`);
          continue;
        }
        const raw = JSON.stringify(r);
        if (r.spam || !r.relevante) {
          await discardNews(
            db,
            { id: item.id, theme_id: theme.id, topic: theme.slug, title: item.title, description: r.resumo, source_name: item.source_name, source_url: item.source_url, published_at: item.published_at },
            r.spam ? "Marcada como spam pela IA" : "Marcada como irrelevante pela IA para o tema",
            raw,
          );
          continue;
        }
        const { error: aErr } = await db.from("news_analysis").upsert(
          {
            news_id: item.id,
            summary: r.resumo,
            relevance: r.relevancia,
            angle: r.angulo,
            entities: r.entidades,
            sentiment: r.sentimento,
            is_relevant: true,
            is_spam: false,
            model: AI_MODEL,
            prompt_version: PROMPT_VERSION,
            analyzed_at: new Date().toISOString(),
          },
          { onConflict: "news_id" },
        );
        if (aErr) console.error(LOG, "news_analysis upsert failed:", aErr.message);

        await db.from("news").update({ description: r.resumo, status: "publicada" }).eq("id", item.id);
      }
    } else {
      console.warn(LOG, `${theme.slug}: IA indisponível — ${toAnalyze.length} itens retidos como arquivada/sem análise`);
    }
  }

  // 7) Só depois de publicar as novas: arquiva o excedente mantendo as 10 mais recentes
  const { data: published } = await db
    .from("news")
    .select("id")
    .eq("theme_id", theme.id)
    .eq("status", "publicada")
    .order("published_at", { ascending: false });
  const excess = (published ?? []).slice(PUBLISHED_PER_THEME).map((p: { id: string }) => p.id);
  if (excess.length) {
    await db.from("news").update({ status: "arquivada" }).in("id", excess);
    console.log(LOG, `${theme.slug}: ${excess.length} arquivadas por excedente`);
  }
}

// ------------------------------------------------------------------
// Retenção: arquivadas > 90 dias sem cliques
// ------------------------------------------------------------------
async function applyRetention(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 86400000).toISOString();
  const { data: old } = await db
    .from("news")
    .select("id, news_clicks(id)")
    .eq("status", "arquivada")
    .lt("fetched_at", cutoff)
    .limit(500);
  const ids = (old ?? []).filter((n: { news_clicks: unknown[] }) => !n.news_clicks?.length).map((n: { id: string }) => n.id);
  if (ids.length) {
    const { error } = await db.from("news").delete().in("id", ids);
    if (error) console.error(LOG, "retention delete failed:", error.message);
    else console.log(LOG, `Retenção: ${ids.length} arquivadas antigas removidas`);
  }
}

// ------------------------------------------------------------------
// Entrypoint
// ------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: themes }, { data: sources }, { data: settings }] = await Promise.all([
      db.from("themes").select("id, slug, name, description").eq("active", true).order("sort_order"),
      db.from("sources").select("id, theme_id, kind, name, query, max_items, consecutive_failures").eq("active", true).eq("kind", "google_news_rss"),
      db.from("app_settings").select("value").eq("key", "blocked_domains").maybeSingle(),
    ]);

    const blockedDomains: string[] = Array.isArray(settings?.value) ? (settings!.value as unknown[]).filter((d): d is string => typeof d === "string") : [];
    console.log(LOG, `Iniciando: ${themes?.length ?? 0} temas, ${sources?.length ?? 0} fontes, ${blockedDomains.length} domínios bloqueados`);

    for (const theme of (themes ?? []) as Theme[]) {
      const themeSources = ((sources ?? []) as Source[]).filter((s) => s.theme_id === theme.id);
      if (themeSources.length === 0) {
        console.warn(LOG, `Tema ${theme.slug} sem fontes ativas`);
        continue;
      }
      try {
        await processTheme(db, theme, themeSources, blockedDomains);
      } catch (e) {
        console.error(LOG, `Erro no tema ${theme.slug}:`, e instanceof Error ? e.message : String(e));
      }
    }

    await applyRetention(db);

    console.log(LOG, `Concluído em ${Date.now() - startedAt}ms`);
    return new Response(JSON.stringify({ success: true, duration_ms: Date.now() - startedAt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(LOG, "Erro fatal", error);
    return new Response(JSON.stringify({ error: "Failed to refresh news" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
