import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = "[NewsletterSend]";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_PER_TOPIC = 3;
const SITE_URL = "https://boletim.conexoesdosaber.com.br";

interface NewsItem {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  source_url: string;
  source_name: string | null;
  published_at: string;
  fetched_at: string;
}

interface Subscriber {
  id: string;
  email: string;
  topics: string[];
  last_sent_at: string | null;
  unsubscribe_token: string | null;
}

const topicLabels: Record<string, string> = {
  mitologia: "Mitologia",
  filosofia: "Filosofia",
  religiao: "Religião",
  artes: "Artes",
  psicologia: "Psicologia",
};

const maskEmail = (email: string): string => email.replace(/(.{2}).*(@.*)/, "$1***$2");

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateEmailHtml(news: NewsItem[], unsubscribeUrl: string): string {
  const grouped = news.reduce<Record<string, NewsItem[]>>((acc, item) => {
    (acc[item.topic] ??= []).push(item);
    return acc;
  }, {});

  const newsHtml = Object.entries(grouped)
    .map(
      ([topic, items]) => `
      <div style="margin-bottom: 28px;">
        <h2 style="font-family: Georgia, 'Noto Serif', serif; color: #041026; font-size: 18px; border-bottom: 2px solid #fdd186; padding-bottom: 8px; margin: 0 0 16px 0;">
          ${escapeHtml(topicLabels[topic] || topic)}
        </h2>
        ${items
          .map((item) => {
            const summary = item.description?.trim();
            return `
          <div style="margin-bottom: 16px; padding: 14px; background: #f7f7f7; border-radius: 6px;">
            <h3 style="margin: 0 0 6px 0; font-size: 16px; line-height: 1.35;">
              <a href="${escapeHtml(item.source_url)}" style="color: #041026; text-decoration: none;">${escapeHtml(item.title)}</a>
            </h3>
            ${summary ? `<p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.45; color: #333;">${escapeHtml(summary)}</p>` : ""}
            <p style="margin: 0; font-size: 12px; color: #666;">
              ${item.source_name ? `${escapeHtml(item.source_name)} · ` : ""}${new Date(item.published_at).toLocaleDateString("pt-BR")}
            </p>
          </div>`;
          })
          .join("")}
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
  <header style="text-align: center; margin-bottom: 32px;">
    <h1 style="font-family: Georgia, 'Noto Serif', serif; color: #041026; font-size: 24px; margin: 0;">Boletim — Conexões do Saber</h1>
    <p style="color: #666; font-size: 14px; margin-top: 8px;">Seu briefing diário das humanidades</p>
  </header>
  <main>${newsHtml}</main>
  <footer style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
    <p style="font-size: 12px; color: #999;">Você recebe este e-mail porque confirmou sua inscrição no Boletim. <a href="${SITE_URL}" style="color: #666;">Abrir o Boletim</a></p>
    <p style="font-size: 12px; margin-top: 8px;"><a href="${unsubscribeUrl}" style="color: #666;">Cancelar inscrição</a></p>
  </footer>
</body>
</html>`;
}

/** Envia via Resend registrando status HTTP, duração e erro em integration_calls (integration = 'resend'). */
async function sendViaResend(
  db: SupabaseClient,
  apiKey: string,
  payload: { from: string; to: string[]; subject: string; html: string },
): Promise<{ ok: boolean; status: number | null; providerId: string | null; error: string | null }> {
  const started = Date.now();
  let status: number | null = null;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    status = res.status;
    const text = await res.text();
    const duration = Date.now() - started;
    if (!res.ok) {
      await db.from("integration_calls").insert({ integration: "resend", endpoint: "emails", method: "POST", http_status: status, duration_ms: duration, ok: false, items_in: 1, items_new: 0, error: text.slice(0, 2000) });
      return { ok: false, status, providerId: null, error: `HTTP ${status}: ${text.slice(0, 500)}` };
    }
    let providerId: string | null = null;
    try {
      providerId = (JSON.parse(text) as { id?: string }).id ?? null;
    } catch { /* corpo não-JSON: segue sem id */ }
    await db.from("integration_calls").insert({ integration: "resend", endpoint: "emails", method: "POST", http_status: status, duration_ms: duration, ok: true, items_in: 1, items_new: 1, error: null });
    return { ok: true, status, providerId, error: null };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await db.from("integration_calls").insert({ integration: "resend", endpoint: "emails", method: "POST", http_status: status, duration_ms: Date.now() - started, ok: false, items_in: 1, items_new: 0, error: err.slice(0, 2000) });
    return { ok: false, status, providerId: null, error: err };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error(LOG, "RESEND_API_KEY não configurada");
      return jsonResponse({ error: "RESEND_API_KEY não configurada" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Só quem confirmou a inscrição
    const { data: subscribers, error: subError } = await db
      .from("newsletter_subscriptions")
      .select("id, email, topics, last_sent_at, unsubscribe_token")
      .eq("confirmed", true);
    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      console.log(LOG, "Nenhum assinante confirmado");
      return jsonResponse({ success: true, sent: 0, failed: 0, skipped: 0, total: 0, message: "Nenhum assinante confirmado" });
    }
    console.log(LOG, `${subscribers.length} assinantes confirmados`);

    const last24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const today = new Date().toDateString();
    let sent = 0, failed = 0, skipped = 0;

    for (const subscriber of subscribers as Subscriber[]) {
      if (subscriber.last_sent_at && new Date(subscriber.last_sent_at).toDateString() === today) {
        skipped++;
        continue;
      }

      let query = db
        .from("news")
        .select("id, title, description, topic, source_url, source_name, published_at, fetched_at")
        .eq("status", "publicada")
        .in("topic", subscriber.topics)
        .gte("published_at", last24h)
        .order("published_at", { ascending: false });
      if (subscriber.last_sent_at) query = query.gt("fetched_at", subscriber.last_sent_at);

      const { data: allNews, error: newsError } = await query;
      if (newsError) {
        console.error(LOG, `Erro ao buscar notícias para ${subscriber.id}:`, newsError.message);
        continue;
      }

      const byTopic: Record<string, NewsItem[]> = {};
      for (const item of (allNews ?? []) as NewsItem[]) {
        (byTopic[item.topic] ??= []);
        if (byTopic[item.topic].length < MAX_PER_TOPIC) byTopic[item.topic].push(item);
      }
      const news = Object.values(byTopic).flat();
      if (news.length === 0) {
        skipped++;
        continue;
      }

      const unsubscribeUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${subscriber.unsubscribe_token ?? "invalid"}`;
      const subject = `Boletim de hoje — ${new Date().toLocaleDateString("pt-BR")}`;
      console.log(LOG, `Enviando ${news.length} itens para ${maskEmail(subscriber.email)}`);

      const result = await sendViaResend(db, resendKey, {
        from: "Boletim Conexões do Saber <noreply@institutodedalus.com.br>",
        to: [subscriber.email],
        subject,
        html: generateEmailHtml(news, unsubscribeUrl),
      });

      const { error: briefingError } = await db.from("briefings").insert({
        subscriber_id: subscriber.id,
        subject,
        news_ids: news.map((n) => n.id),
        status: result.ok ? "enviado" : "falhou",
        provider_id: result.providerId,
        error: result.error,
      });
      if (briefingError) console.error(LOG, "briefings insert failed:", briefingError.message);

      if (!result.ok) {
        failed++;
        console.error(LOG, `Falha no envio para ${maskEmail(subscriber.email)}: ${result.error}`);
        continue;
      }

      const { error: updateError } = await db
        .from("newsletter_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", subscriber.id);
      if (updateError) console.error(LOG, `Erro ao atualizar last_sent_at de ${subscriber.id}:`, updateError.message);
      sent++;
    }

    console.log(LOG, `Concluído. Enviados: ${sent}, Falhas: ${failed}, Pulados: ${skipped}`);
    return jsonResponse({ success: true, sent, failed, skipped, total: subscribers.length });
  } catch (error) {
    console.error(LOG, "Erro:", error);
    return jsonResponse({ error: "Erro ao enviar newsletter" }, 500);
  }
});
