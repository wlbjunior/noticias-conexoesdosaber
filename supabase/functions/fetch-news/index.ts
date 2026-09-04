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
const CANDIDATES_PER_THEME = 12; // candidatas novas por tema (fontes temáticas)
const GENERAL_CANDIDATES_MAX = 40; // candidatas novas por rodada (fontes gerais, 1 lote de IA)
const ARCHIVE_RETENTION_DAYS = 90;
const AI_MODEL = "google/gemini-3.5-flash";
const PROMPT_VERSION = "boletim-v2";
const AI_MAX_RETRIES = 3;
const REDIRECT_TIMEOUT_MS = 2500;
const RSS_TIMEOUT_MS = 12000;

// Google Notícias: limite por rajada — espaçar buscas e recuar mais no 503
const GOOGLE_MIN_GAP_MS = 4000; // 3–5 s entre buscas diferentes
const GOOGLE_BACKOFF_MS = [3000, 8000, 20000]; // esperas entre tentativas no 503/429
const GOOGLE_CIRCUIT_FAILURES = 1; // após N fontes seguidas esgotando todo o retry (4×503), pula o resto do Google nesta rodada
const NONE_THEME = "nenhum";

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
  theme_id: string | null;
  kind: "google_news_rss" | "rss" | string;
  name: string;
  query: string | null;
  url: string | null;
  max_items: number;
  consecutive_failures: number;
}

interface Candidate {
  theme_id: string | null;
  topic: string | null;
  title: string;
  source_name: string | null;
  source_url: string;
  published_at: string;
  snippet: string | null;
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
  tema: string | null; // só no modo classificação (fontes gerais)
}

interface Preclassified {
  candidate: Candidate;
  analysis: AnalysisResult;
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

interface InsertedRow {
  id: string;
  title: string;
  source_name: string | null;
  source_url: string;
  published_at: string;
}

// ------------------------------------------------------------------
// Telemetria
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

/** Atom: <link href="..."/> sem conteúdo. */
function extractLinkHref(item: string): string | null {
  const m = item.match(/<link[^>]*\shref=["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1].trim() : null;
}

function parseFeed(xml: string, source: Source, theme: Theme | null): { candidates: Candidate[]; parsed: number } {
  const candidates: Candidate[] = [];
  const isGoogle = source.kind === "google_news_rss";
  // RSS 2.0 <item> ou Atom <entry>
  const itemRegex = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  let parsed = 0;

  while ((match = itemRegex.exec(xml)) !== null && candidates.length < source.max_items) {
    parsed++;
    const item = match[2];
    const rawTitle = extract(item, "title");
    const rawLink = extract(item, "link") ?? extractLinkHref(item);
    const rawPubDate = extract(item, "pubDate") ?? extract(item, "dc:date") ?? extract(item, "published") ?? extract(item, "updated");
    const rawSource = extract(item, "source");
    const rawDescription = extract(item, "description") ?? extract(item, "summary") ?? extract(item, "content:encoded");

    if (!rawTitle || !rawLink) continue;

    let title = cleanHtml(rawTitle);
    if (isGoogle) {
      // Google anexa " - Nome do veículo" ao título
      const dashIndex = title.lastIndexOf(" - ");
      if (dashIndex > 0 && dashIndex > title.length * 0.5) title = title.slice(0, dashIndex).trim();
    }
    if (!title) continue;

    const link = cleanHtml(rawLink);
    if (!/^https?:\/\//i.test(link)) continue;

    const sourceName = isGoogle ? (rawSource ? cleanHtml(rawSource) : "Google News") : source.name;
    const pub = rawPubDate ? new Date(rawPubDate) : null;
    const publishedAt = pub && !isNaN(pub.getTime()) ? pub.toISOString() : new Date().toISOString();
    const snippet = !isGoogle && rawDescription ? cleanHtml(rawDescription).slice(0, 300) || null : null;

    candidates.push({
      theme_id: theme?.id ?? null,
      topic: theme?.slug ?? null,
      title,
      source_name: sourceName,
      source_url: link,
      published_at: publishedAt,
      snippet,
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

function buildSourceUrl(source: Source): string | null {
  if (source.kind === "google_news_rss") {
    if (!source.query) return null;
    return `https://news.google.com/rss/search?q=${encodeURIComponent(source.query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  }
  if (source.kind === "rss") return source.url && /^https?:\/\//i.test(source.url) ? source.url : null;
  return null;
}

/** Estado compartilhado da rodada para o Google Notícias (espaçamento + disjuntor). */
class GoogleGate {
  private lastFetchAt = 0;
  private exhaustedInARow = 0;

  get open() {
    return this.exhaustedInARow < GOOGLE_CIRCUIT_FAILURES;
  }
  async waitTurn() {
    const elapsed = Date.now() - this.lastFetchAt;
    if (this.lastFetchAt && elapsed < GOOGLE_MIN_GAP_MS) await sleep(GOOGLE_MIN_GAP_MS - elapsed);
  }
  markFetched() {
    this.lastFetchAt = Date.now();
  }
  markResult(exhausted: boolean) {
    this.exhaustedInARow = exhausted ? this.exhaustedInARow + 1 : 0;
  }
}

async function fetchSource(db: SupabaseClient, source: Source, theme: Theme | null, gate: GoogleGate): Promise<Candidate[]> {
  const isGoogle = source.kind === "google_news_rss";
  const integration = source.kind;
  const label = source.name;
  const url = buildSourceUrl(source);

  if (!url) {
    await updateSourceHealth(db, source, false, `configuração inválida para kind=${source.kind}`);
    return [];
  }
  if (isGoogle && !gate.open) {
    // Não fazemos requisição, então não gravamos integration_calls — só o status real da fonte
    await updateSourceHealth(db, source, false, "pulada: Google Notícias com 503 persistente nesta rodada");
    console.warn(LOG, `Google "${label}" pulada (disjuntor aberto)`);
    return [];
  }

  const started = Date.now();
  let status: number | null = null;
  let exhausted = false;

  try {
    let res: Response | null = null;
    const attempts = isGoogle ? GOOGLE_BACKOFF_MS.length + 1 : 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (isGoogle) await gate.waitTurn();
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
      try {
        res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(t);
        if (isGoogle) gate.markFetched();
      }
      const transient = res.status === 503 || res.status === 429 || res.status >= 500;
      if (res.ok || !transient || attempt === attempts) {
        exhausted = isGoogle && !res.ok && transient;
        break;
      }
      const wait = isGoogle ? GOOGLE_BACKOFF_MS[attempt - 1] : 2000;
      console.warn(LOG, `${integration} "${label}" HTTP ${res.status}, tentativa ${attempt}, aguardando ${wait}ms`);
      await sleep(wait);
    }
    if (!res) throw new Error("sem resposta");
    status = res.status;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const duration = Date.now() - started;

    if (!res.ok) {
      const err = `HTTP ${res.status}`;
      await logCall(db, { integration, endpoint: url, http_status: status, duration_ms: duration, ok: false, error: err });
      await updateSourceHealth(db, source, false, err);
      if (isGoogle) gate.markResult(exhausted);
      return [];
    }

    const xml = decodeBody(bytes, detectCharset(res.headers.get("content-type"), bytes));
    const { candidates, parsed } = parseFeed(xml, source, theme);

    if (parsed === 0) {
      const err = "resposta 200 sem itens reconhecíveis (não é RSS/Atom?)";
      await logCall(db, { integration, endpoint: url, http_status: status, duration_ms: duration, ok: false, items_in: 0, error: err });
      await updateSourceHealth(db, source, false, err);
      if (isGoogle) gate.markResult(false);
      return [];
    }

    await logCall(db, { integration, endpoint: url, http_status: status, duration_ms: duration, ok: true, items_in: parsed });
    await updateSourceHealth(db, source, true);
    if (isGoogle) gate.markResult(false);
    console.log(LOG, `${integration} "${label}": ${parsed} itens, ${candidates.length} válidos`);
    return candidates;
  } catch (e) {
    const err = e instanceof Error ? (e.name === "AbortError" ? `timeout após ${RSS_TIMEOUT_MS}ms` : e.message) : String(e);
    await logCall(db, { integration, endpoint: url, http_status: status, duration_ms: Date.now() - started, ok: false, error: err });
    await updateSourceHealth(db, source, false, err);
    if (isGoogle) gate.markResult(false);
    console.error(LOG, `${integration} "${label}" falhou:`, err);
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
// IA — tool calling em lote. Dois modos:
//   validar   (theme definido): a IA confirma se o item é do tema
//   classificar (theme nulo):   a IA ESCOLHE o tema entre os slugs ativos ou "nenhum"
// ------------------------------------------------------------------
function buildAnalysisTool(themeSlugs: string[] | null) {
  const itemProps: Record<string, unknown> = {
    id: { type: "string", description: "id exatamente como recebido" },
    resumo: { type: "string", description: "Resumo factual em PT-BR, 1-2 frases, baseado só no título, fonte e trecho. Se não for possível, string vazia." },
    relevancia: { type: "integer", minimum: 0, maximum: 100 },
    angulo: { type: "string", description: "Ângulo editorial em poucas palavras" },
    entidades: { type: "array", items: { type: "string" } },
    sentimento: { type: "string", enum: ["positivo", "neutro", "negativo"] },
    spam: { type: "boolean", description: "true se for propaganda, apostas, cassino, promoção, conteúdo enganoso ou sem valor jornalístico" },
  };
  const required = ["id", "spam"];
  if (themeSlugs) {
    itemProps.tema = {
      type: "string",
      enum: [...themeSlugs, NONE_THEME],
      description: `Tema do Boletim ao qual a notícia pertence, ou "${NONE_THEME}" se não se enquadra em nenhum`,
    };
    required.push("tema");
  } else {
    itemProps.relevante = { type: "boolean", description: "true se o tema principal é realmente o tema indicado" };
    required.push("relevante");
  }
  return {
    type: "function",
    function: {
      name: "registrar_analises",
      description: "Registra a análise editorial de cada notícia recebida.",
      parameters: {
        type: "object",
        properties: {
          analises: {
            type: "array",
            items: { type: "object", properties: itemProps, required, additionalProperties: false },
          },
        },
        required: ["analises"],
        additionalProperties: false,
      },
    },
  };
}

interface AnalyzeInput {
  id: string;
  title: string;
  source_name: string | null;
  snippet?: string | null;
}

// Disjuntor da IA dentro de uma execução: 402 (sem créditos) e 403 (bloqueio de política)
// não são transitórios — após o primeiro, as demais chamadas da rodada são puladas.
const aiState: { blockedStatus: number | null; lastStatus: number | null } = { blockedStatus: null, lastStatus: null };
function resetAiState() {
  aiState.blockedStatus = null;
  aiState.lastStatus = null;
}

async function analyzeBatch(
  db: SupabaseClient,
  mode: { kind: "validar"; theme: Theme } | { kind: "classificar"; themes: Theme[] },
  items: AnalyzeInput[],
): Promise<AnalysisResult[] | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn(LOG, "LOVABLE_API_KEY ausente — itens ficam retidos sem análise");
    return null;
  }
  if (aiState.blockedStatus !== null) {
    console.warn(LOG, `IA bloqueada nesta execução (HTTP ${aiState.blockedStatus}) — lote pulado`);
    return null;
  }

  const endpointTag = mode.kind === "validar" ? mode.theme.slug : "geral";
  const themeSlugs = mode.kind === "classificar" ? mode.themes.map((t) => t.slug) : null;
  const tool = buildAnalysisTool(themeSlugs);

  const base =
    `Você é editor do Boletim Conexões do Saber, um portal de humanidades. ` +
    `Marque spam=true para apostas, cassinos, bônus, cupons, conteúdo patrocinado ou sem valor jornalístico. ` +
    `O resumo deve ser factual e derivado apenas do título, fonte e trecho — nunca invente fatos; se não houver base, deixe vazio. ` +
    `Responda SOMENTE chamando a ferramenta registrar_analises, incluindo TODOS os ids recebidos.`;
  const systemPrompt =
    mode.kind === "validar"
      ? `${base} Avalie cada notícia para o tema "${mode.theme.name}" (${mode.theme.description ?? ""}). ` +
        `Seja rigoroso: se o assunto principal for outro (esporte, política partidária, celebridades, jogos de azar, promoções), marque relevante=false.`
      : `${base} As notícias vêm de veículos de interesse geral. Para cada uma, escolha o tema do Boletim ao qual ela pertence de fato:\n` +
        mode.themes.map((t) => `- ${t.slug}: ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n") +
        `\nSeja rigoroso: só atribua um tema quando ele for o assunto principal da notícia. ` +
        `Se for esporte, política partidária, economia, celebridades, tecnologia ou qualquer assunto fora desses temas, use tema="${NONE_THEME}".`;

  const userPrompt = items
    .map((i) => `id: ${i.id}\ntítulo: ${i.title}\nfonte: ${i.source_name ?? "desconhecida"}${i.snippet ? `\ntrecho: ${i.snippet}` : ""}`)
    .join("\n\n");

  const endpoint = `chat/completions#${endpointTag}`;

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
          tools: [tool],
          tool_choice: { type: "function", function: { name: "registrar_analises" } },
        }),
      });
      status = res.status;
      aiState.lastStatus = status;
      const duration = Date.now() - started;

      if (!res.ok) {
        const body = await res.text();
        await logCall(db, { integration: "lovable_ai", endpoint, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: body.slice(0, 500) });
        if (status === 402 || status === 403) {
          // Terminal: sem créditos / bloqueado por política. Não há retry e o resto da execução é pulado.
          aiState.blockedStatus = status;
          console.error(LOG, `IA ${status} (${endpointTag}) — disjuntor aberto para o resto desta execução`);
          return null;
        }
        if ((status === 429 || status >= 500) && attempt < AI_MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("Retry-After"));
          const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** (attempt - 1);
          console.warn(LOG, `IA ${status} (${endpointTag}), tentativa ${attempt}, aguardando ${wait}ms`);
          await sleep(wait);
          continue;
        }
        console.error(LOG, `IA falhou definitivamente para ${endpointTag}: ${status}`);
        return null;
      }

      const data = await res.json();
      const call = data?.choices?.[0]?.message?.tool_calls?.[0];
      if (!call?.function?.arguments) {
        await logCall(db, { integration: "lovable_ai", endpoint, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: "resposta sem tool_call" });
        return null;
      }

      let parsed: { analises?: unknown[] };
      try {
        parsed = JSON.parse(call.function.arguments);
      } catch (e) {
        await logCall(db, { integration: "lovable_ai", endpoint, method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: items.length, error: `JSON inválido: ${String(e)}` });
        return null;
      }

      const validIds = new Set(items.map((i) => i.id));
      const validThemes = themeSlugs ? new Set([...themeSlugs, NONE_THEME]) : null;
      const results: AnalysisResult[] = [];
      for (const a of parsed.analises ?? []) {
        const r = a as Record<string, unknown>;
        if (typeof r.id !== "string" || !validIds.has(r.id)) continue;
        // Valida o tema devolvido contra os slugs reais; valor desconhecido é descartado (item fica retido)
        let tema: string | null = null;
        if (validThemes) {
          if (typeof r.tema !== "string" || !validThemes.has(r.tema)) {
            console.warn(LOG, `IA devolveu tema inválido "${String(r.tema)}" para ${r.id} — ignorado`);
            continue;
          }
          tema = r.tema;
        }
        results.push({
          id: r.id,
          resumo: typeof r.resumo === "string" && r.resumo.trim() ? r.resumo.trim().slice(0, 600) : null,
          relevancia: typeof r.relevancia === "number" ? Math.max(0, Math.min(100, Math.round(r.relevancia))) : null,
          angulo: typeof r.angulo === "string" && r.angulo.trim() ? r.angulo.trim().slice(0, 200) : null,
          entidades: Array.isArray(r.entidades) ? r.entidades.filter((e): e is string => typeof e === "string").slice(0, 10) : [],
          sentimento: typeof r.sentimento === "string" ? r.sentimento : null,
          relevante: validThemes ? tema !== NONE_THEME : r.relevante === true,
          spam: r.spam === true,
          tema,
        });
      }

      await logCall(db, { integration: "lovable_ai", endpoint, method: "POST", http_status: status, duration_ms: duration, ok: true, items_in: items.length, items_new: results.length });
      console.log(LOG, `IA ${endpointTag}: ${results.length}/${items.length} analisadas`);
      return results;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logCall(db, { integration: "lovable_ai", endpoint, method: "POST", http_status: status, duration_ms: Date.now() - started, ok: false, items_in: items.length, error: err });
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
  row: { id?: string; theme_id: string | null; topic: string | null; title: string; description?: string | null; source_name: string | null; source_url: string; published_at: string },
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

async function publishWithAnalysis(db: SupabaseClient, newsId: string, r: AnalysisResult) {
  const { error: aErr } = await db.from("news_analysis").upsert(
    {
      news_id: newsId,
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
  await db.from("news").update({ description: r.resumo, status: "publicada" }).eq("id", newsId);
}

// ------------------------------------------------------------------
// Pipeline comum: dedup → filtra conhecidos → anti-spam barato → redirect
// ------------------------------------------------------------------
async function dedupCandidates(collected: Candidate[]): Promise<Candidate[]> {
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
  return deduped;
}

async function filterKnown(db: SupabaseClient, collected: Candidate[]): Promise<{ fresh: Candidate[]; restoredByAdmin: Set<string> }> {
  if (collected.length === 0) return { fresh: [], restoredByAdmin: new Set() };
  const hashes = await Promise.all(collected.map((c) => sha256Hex(canonicalUrl(c.source_url))));
  const { data: known } = await db.from("news").select("url_hash").in("url_hash", hashes);
  const knownHashes = new Set((known ?? []).map((k: { url_hash: string }) => k.url_hash));
  const { data: discarded } = await db
    .from("discarded_news")
    .select("source_url, restored")
    .in("source_url", collected.map((c) => c.source_url));
  const alreadyDiscarded = new Set((discarded ?? []).filter((d: { restored: boolean }) => !d.restored).map((d: { source_url: string }) => d.source_url));
  const restoredByAdmin = new Set((discarded ?? []).filter((d: { restored: boolean }) => d.restored).map((d: { source_url: string }) => d.source_url));
  const fresh = collected.filter((c, i) => !knownHashes.has(hashes[i]) && !alreadyDiscarded.has(c.source_url));
  return { fresh, restoredByAdmin };
}

async function cheapFilters(db: SupabaseClient, fresh: Candidate[], blockedDomains: string[]): Promise<Candidate[]> {
  const passed: Candidate[] = [];
  for (const c of fresh) {
    const kwReason = keywordSpamReason(c.title, c.source_name);
    if (kwReason) {
      await discardNews(db, c, `Spam (${kwReason})`, null);
      continue;
    }
    passed.push(c);
  }
  const redirectChecks = await Promise.all(passed.map((c) => resolvesToBlockedDomain(c.source_url, blockedDomains)));
  const out: Candidate[] = [];
  for (let i = 0; i < passed.length; i++) {
    if (redirectChecks[i]) await discardNews(db, passed[i], "Redireciona para domínio bloqueado", null);
    else out.push(passed[i]);
  }
  return out;
}

async function insertArchived(db: SupabaseClient, toInsert: Candidate[]): Promise<InsertedRow[]> {
  if (toInsert.length === 0) return [];
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
    console.error(LOG, "Insert em news falhou:", error.message);
    return [];
  }
  return data ?? [];
}

// ------------------------------------------------------------------
// Fontes gerais: 1 lote por rodada, a IA atribui o tema
// ------------------------------------------------------------------
async function classifyGeneralSources(
  db: SupabaseClient,
  generalSources: Source[],
  themes: Theme[],
  blockedDomains: string[],
  gate: GoogleGate,
): Promise<{ byTheme: Map<string, Preclassified[]>; collectedCount: number }> {
  const byTheme = new Map<string, Preclassified[]>();
  if (generalSources.length === 0) return { byTheme, collectedCount: 0 };
  console.log(LOG, `=== Fontes gerais (${generalSources.length}) ===`);

  let collected: Candidate[] = [];
  for (const source of generalSources) collected.push(...(await fetchSource(db, source, null, gate)));
  const collectedCount = collected.length;
  if (collectedCount === 0) return { byTheme, collectedCount };

  collected = await dedupCandidates(collected);
  const { fresh } = await filterKnown(db, collected);
  console.log(LOG, `geral: ${collected.length} únicas, ${fresh.length} inéditas`);
  const passed = (await cheapFilters(db, fresh, blockedDomains)).slice(0, GENERAL_CANDIDATES_MAX);
  if (passed.length === 0) return { byTheme, collectedCount };

  // ids temporários só para o lote (itens ainda não estão em news)
  const inputs: AnalyzeInput[] = passed.map((c, i) => ({ id: `g${i}`, title: c.title, source_name: c.source_name, snippet: c.snippet }));
  const results = await analyzeBatch(db, { kind: "classificar", themes }, inputs);
  if (!results) {
    console.warn(LOG, `geral: IA indisponível — ${passed.length} itens não classificados (voltam na próxima rodada)`);
    return { byTheme, collectedCount };
  }

  const themeBySlug = new Map(themes.map((t) => [t.slug, t]));
  const byId = new Map(results.map((r) => [r.id, r]));
  let assigned = 0, none = 0, spam = 0;
  for (let i = 0; i < passed.length; i++) {
    const c = passed[i];
    const r = byId.get(`g${i}`);
    if (!r) continue; // sem análise: fica retido, tenta de novo na próxima
    const raw = JSON.stringify(r);
    if (r.spam) {
      spam++;
      await discardNews(db, c, "Marcada como spam pela IA", raw);
      continue;
    }
    if (!r.tema || r.tema === NONE_THEME) {
      none++;
      await discardNews(db, c, "Não se enquadra em nenhum tema", raw);
      continue;
    }
    const theme = themeBySlug.get(r.tema);
    if (!theme) continue; // já validado em analyzeBatch; defesa extra
    const list = byTheme.get(theme.id) ?? [];
    list.push({ candidate: { ...c, theme_id: theme.id, topic: theme.slug }, analysis: r });
    byTheme.set(theme.id, list);
    assigned++;
  }
  console.log(LOG, `geral: ${assigned} atribuídas a temas, ${none} sem tema, ${spam} spam`);
  return { byTheme, collectedCount };
}

// ------------------------------------------------------------------
// Processamento por tema
// ------------------------------------------------------------------
async function processTheme(
  db: SupabaseClient,
  theme: Theme,
  sources: Source[],
  blockedDomains: string[],
  gate: GoogleGate,
  preclassified: Preclassified[],
): Promise<{ generalInserted: number }> {
  console.log(LOG, `=== Tema ${theme.slug} (${sources.length} fontes temáticas + ${preclassified.length} vindas de fontes gerais) ===`);
  const started = Date.now();

  // 1) Coleta das fontes temáticas
  let collected: Candidate[] = [];
  for (const source of sources) collected.push(...(await fetchSource(db, source, theme, gate)));
  const candidatesIn = collected.length + preclassified.length;

  // 2) Dedup + conhecidos + barreiras baratas (só para as temáticas; as gerais já passaram)
  collected = await dedupCandidates(collected);
  const { fresh, restoredByAdmin } = await filterKnown(db, collected);
  console.log(LOG, `${theme.slug}: ${collected.length} únicas, ${fresh.length} inéditas`);
  const ownToInsert = (await cheapFilters(db, fresh, blockedDomains)).slice(0, CANDIDATES_PER_THEME);

  // Gerais: só as que não colidem com as temáticas desta rodada
  const ownUrls = new Set(ownToInsert.map((c) => canonicalUrl(c.source_url)));
  const generalToInsert = preclassified.filter((p) => !ownUrls.has(canonicalUrl(p.candidate.source_url)));
  const analysisByUrl = new Map(generalToInsert.map((p) => [canonicalUrl(p.candidate.source_url), p.analysis]));

  // 3) Insere tudo como arquivada
  const inserted = await insertArchived(db, [...ownToInsert, ...generalToInsert.map((p) => p.candidate)]);
  let generalInserted = 0;
  for (const r of inserted) if (analysisByUrl.has(canonicalUrl(r.source_url))) generalInserted++;
  console.log(LOG, `${theme.slug}: ${inserted.length} novas inseridas (${generalInserted} de fontes gerais)`);

  // 4) Restauradas manualmente pelo admin: publicam sem passar pela IA
  const restoredNow = inserted.filter((r) => restoredByAdmin.has(r.source_url));
  if (restoredNow.length) await db.from("news").update({ status: "publicada" }).in("id", restoredNow.map((r) => r.id));

  // 5) Gerais já classificadas: publica direto com a análise do lote geral
  for (const r of inserted) {
    const a = analysisByUrl.get(canonicalUrl(r.source_url));
    if (a) await publishWithAnalysis(db, r.id, a);
  }

  // 6) IA em lote (validação): novas temáticas + pendentes de rodadas anteriores (backfill).
  //    Inclui as "arquivada" sem análise: são as retidas quando a IA falhou fechada em rodadas passadas.
  const { data: unanalyzed } = await db
    .from("news")
    .select("id, title, source_name, source_url, published_at, news_analysis(id)")
    .eq("theme_id", theme.id)
    .in("status", ["publicada", "arquivada"])
    .is("news_analysis", null)
    .order("published_at", { ascending: false })
    .limit(20);

  const snippetByUrl = new Map(ownToInsert.map((c) => [c.source_url, c.snippet]));
  const toAnalyzeMap = new Map<string, InsertedRow>();
  for (const r of inserted) {
    if (restoredByAdmin.has(r.source_url) || analysisByUrl.has(canonicalUrl(r.source_url))) continue;
    toAnalyzeMap.set(r.id, r);
  }
  for (const r of unanalyzed ?? []) toAnalyzeMap.set(r.id, r);
  const toAnalyze = [...toAnalyzeMap.values()];

  if (toAnalyze.length > 0) {
    const results = await analyzeBatch(
      db,
      { kind: "validar", theme },
      toAnalyze.map((r) => ({ id: r.id, title: r.title, source_name: r.source_name, snippet: snippetByUrl.get(r.source_url) ?? null })),
    );
    if (results) {
      const byId = new Map(results.map((r) => [r.id, r]));
      for (const item of toAnalyze) {
        const r = byId.get(item.id);
        if (!r) {
          console.warn(LOG, `Item sem análise retornada (fica retido): ${item.title}`);
          continue;
        }
        if (r.spam || !r.relevante) {
          await discardNews(
            db,
            { id: item.id, theme_id: theme.id, topic: theme.slug, title: item.title, description: r.resumo, source_name: item.source_name, source_url: item.source_url, published_at: item.published_at },
            r.spam ? "Marcada como spam pela IA" : "Marcada como irrelevante pela IA para o tema",
            JSON.stringify(r),
          );
          continue;
        }
        await publishWithAnalysis(db, item.id, r);
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

  // 8) Métrica central: candidatos coletados vs. entradas reais em news
  await logCall(db, {
    integration: "ingestao",
    endpoint: theme.slug,
    method: "PIPELINE",
    duration_ms: Date.now() - started,
    ok: true,
    items_in: candidatesIn,
    items_new: inserted.length,
  });

  return { generalInserted };
}

// ------------------------------------------------------------------
// Retenção: arquivadas > 90 dias sem cliques e sem pauta associada
// ------------------------------------------------------------------
async function applyRetention(db: SupabaseClient) {
  const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 86400000).toISOString();
  const { data: old } = await db
    .from("news")
    .select("id, news_clicks(id), pautas(id)")
    .eq("status", "arquivada")
    .lt("fetched_at", cutoff)
    .limit(500);
  type OldRow = { id: string; news_clicks: unknown[] | null; pautas: unknown[] | null };
  const ids = ((old ?? []) as OldRow[])
    .filter((n) => !n.news_clicks?.length && !n.pautas?.length)
    .map((n) => n.id);
  if (ids.length) {
    const { error } = await db.from("news").delete().in("id", ids);
    if (error) console.error(LOG, "retention delete failed:", error.message);
    else console.log(LOG, `Retenção: ${ids.length} arquivadas antigas removidas (preservadas: com clique ou com pauta)`);
  }
}

// ------------------------------------------------------------------
// Rodada completa (roda em segundo plano — o cron/cliente não precisa esperar)
// ------------------------------------------------------------------
async function runCollection(): Promise<void> {
  const startedAt = Date.now();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: themes }, { data: sources }, { data: settings }] = await Promise.all([
    db.from("themes").select("id, slug, name, description").eq("active", true).order("sort_order"),
    db.from("sources").select("id, theme_id, kind, name, query, url, max_items, consecutive_failures").eq("active", true).order("created_at"),
    db.from("app_settings").select("value").eq("key", "blocked_domains").maybeSingle(),
  ]);

  const activeThemes = (themes ?? []) as Theme[];
  const allSources = (sources ?? []) as Source[];
  const generalSources = allSources.filter((s) => s.theme_id === null);
  const blockedDomains: string[] = Array.isArray(settings?.value) ? (settings!.value as unknown[]).filter((d): d is string => typeof d === "string") : [];
  console.log(LOG, `Iniciando: ${activeThemes.length} temas, ${allSources.length} fontes (${generalSources.length} gerais), ${blockedDomains.length} domínios bloqueados`);

  const gate = new GoogleGate();

  // Fontes gerais: uma vez por rodada, a IA atribui o tema
  const generalStarted = Date.now();
  let general: { byTheme: Map<string, Preclassified[]>; collectedCount: number } = { byTheme: new Map(), collectedCount: 0 };
  try {
    general = await classifyGeneralSources(db, generalSources, activeThemes, blockedDomains, gate);
  } catch (e) {
    console.error(LOG, "Erro nas fontes gerais:", e instanceof Error ? e.message : String(e));
  }

  let generalInsertedTotal = 0;
  for (const theme of activeThemes) {
    const themeSources = allSources.filter((s) => s.theme_id === theme.id);
    const pre = general.byTheme.get(theme.id) ?? [];
    if (themeSources.length === 0 && pre.length === 0) {
      console.warn(LOG, `Tema ${theme.slug} sem fontes ativas`);
      continue;
    }
    try {
      const { generalInserted } = await processTheme(db, theme, themeSources, blockedDomains, gate, pre);
      generalInsertedTotal += generalInserted;
    } catch (e) {
      console.error(LOG, `Erro no tema ${theme.slug}:`, e instanceof Error ? e.message : String(e));
    }
  }

  if (generalSources.length > 0) {
    await logCall(db, {
      integration: "ingestao",
      endpoint: "geral",
      method: "PIPELINE",
      duration_ms: Date.now() - generalStarted,
      ok: true,
      items_in: general.collectedCount,
      items_new: generalInsertedTotal,
    });
  }

  await applyRetention(db);
  console.log(LOG, `Concluído em ${Date.now() - startedAt}ms`);
}

// ------------------------------------------------------------------
// Entrypoint
// ------------------------------------------------------------------
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Confirma que quem chama é admin/moderator autenticado (usado só no modo de teste de fonte). */
async function isEditorialStaff(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const [{ data: admin }, { data: mod }] = await Promise.all([
    db.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    db.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
  ]);
  return Boolean(admin || mod);
}

/** Modo "Testar agora": busca uma única fonte, grava saúde + integration_calls e responde na hora. */
async function testSingleSource(sourceId: string): Promise<Response> {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: source } = await db
    .from("sources")
    .select("id, theme_id, kind, name, query, url, max_items, consecutive_failures")
    .eq("id", sourceId)
    .maybeSingle();
  if (!source) return json({ error: "Fonte não encontrada" }, 404);
  let theme: Theme | null = null;
  if (source.theme_id) {
    const { data } = await db.from("themes").select("id, slug, name, description").eq("id", source.theme_id).maybeSingle();
    theme = (data as Theme | null) ?? null;
  }
  const candidates = await fetchSource(db, source as Source, theme, new GoogleGate());
  const { data: updated } = await db
    .from("sources")
    .select("last_status, last_error, last_run_at, consecutive_failures")
    .eq("id", sourceId)
    .maybeSingle();
  return json({ ok: updated?.last_status === "ok", items: candidates.length, source: updated });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "POST") {
    let body: { action?: string; source_id?: string } = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      /* corpo vazio ou não-JSON: segue como coleta completa */
    }
    if (body.action === "test_source") {
      if (typeof body.source_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.source_id)) return json({ error: "source_id inválido" }, 400);
      if (!(await isEditorialStaff(req))) return json({ error: "Acesso restrito à equipe editorial" }, 403);
      return await testSingleSource(body.source_id);
    }
  }

  const job = runCollection().catch((e) => console.error(LOG, "Erro fatal", e));

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // Responde já: a coleta leva minutos e o chamador (cron/admin) não deve segurar a conexão
    EdgeRuntime.waitUntil(job);
    return new Response(JSON.stringify({ accepted: true, message: "Coleta iniciada em segundo plano" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await job;
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
