import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface NewsItem {
  id: string;
  title: string;
  topic: string;
  source_url: string;
  source_name: string | null;
  published_at: string;
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

function generateEmailHtml(news: NewsItem[], unsubscribeUrl: string): string {
  const groupedNews = news.reduce((acc, item) => {
    if (!acc[item.topic]) acc[item.topic] = [];
    acc[item.topic].push(item);
    return acc;
  }, {} as Record<string, NewsItem[]>);

  const newsHtml = Object.entries(groupedNews)
    .map(([topic, items]) => `
      <div style="margin-bottom: 24px;">
        <h2 style="color: #333; font-size: 18px; border-bottom: 2px solid #1E90FF; padding-bottom: 8px; margin-bottom: 16px;">
          ${topicLabels[topic] || topic}
        </h2>
        ${items.map(item => `
          <div style="margin-bottom: 16px; padding: 12px; background: #f9f9f9; border-radius: 8px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px;">
              <a href="${item.source_url}" style="color: #1a1a1a; text-decoration: none;" target="_blank">
                ${item.title}
              </a>
            </h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              ${item.source_name ? `Fonte: ${item.source_name}` : ''} 
              ${new Date(item.published_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        `).join('')}
      </div>
    `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
      <header style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">📰 Notícias Temáticas</h1>
        <p style="color: #666; font-size: 14px; margin-top: 8px;">Seu resumo diário de notícias</p>
      </header>
      
      <main>
        ${newsHtml}
      </main>
      
      <footer style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
        <p style="font-size: 12px; color: #999;">
          Você está recebendo este email porque se inscreveu na nossa newsletter.
        </p>
        <p style="font-size: 12px; margin-top: 8px;">
          <a href="${unsubscribeUrl}" style="color: #666;">Cancelar inscrição</a>
        </p>
      </footer>
    </body>
    </html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Note: This function is rate-limited by cron schedule (once daily at 8AM BRT)
  // Only performs safe read operations and sends emails via Resend
  console.log("[NewsletterSend] Request received");

  // Helper function to mask email addresses in logs
  const maskEmail = (email: string): string => {
    return email.replace(/(.{2}).*(@.*)/, '$1***$2');
  };

  try {
    console.log("[NewsletterSend] Starting daily newsletter send");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all subscribers
    const { data: subscribers, error: subError } = await supabase
      .from("newsletter_subscriptions")
      .select("*");

    if (subError) {
      console.error("[NewsletterSend] Error fetching subscribers:", subError);
      throw subError;
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("[NewsletterSend] No subscribers found");
      return new Response(
        JSON.stringify({ success: true, message: "No subscribers to send to" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[NewsletterSend] Found ${subscribers.length} subscribers`);

    let sentCount = 0;
    let skipCount = 0;

    for (const subscriber of subscribers as Subscriber[]) {
      // Check if already sent today
      if (subscriber.last_sent_at) {
        const lastSent = new Date(subscriber.last_sent_at);
        const today = new Date();
        if (lastSent.toDateString() === today.toDateString()) {
          console.log(`[NewsletterSend] Already sent to subscriber ${subscriber.id} today, skipping`);
          skipCount++;
          continue;
        }
      }

      // Fetch news published in the last 24 hours only
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      let newsQuery = supabase
        .from("news")
        .select("*")
        .in("topic", subscriber.topics)
        .gte("published_at", last24Hours.toISOString())
        .order("published_at", { ascending: false });

      // Only include news fetched after last_sent_at if subscriber has received newsletters before
      if (subscriber.last_sent_at) {
        newsQuery = newsQuery.gt("fetched_at", subscriber.last_sent_at);
      }

      const { data: allNews, error: newsError } = await newsQuery;

      if (newsError) {
        console.error(`[NewsletterSend] Error fetching news for subscriber ${subscriber.id}:`, newsError);
        continue;
      }

      if (!allNews || allNews.length === 0) {
        console.log(`[NewsletterSend] No new news for subscriber ${subscriber.id}, skipping`);
        skipCount++;
        continue;
      }

      // Group by topic and take max 3 per topic
      const newsByTopic: Record<string, NewsItem[]> = {};
      for (const item of allNews as NewsItem[]) {
        if (!newsByTopic[item.topic]) newsByTopic[item.topic] = [];
        if (newsByTopic[item.topic].length < 3) {
          newsByTopic[item.topic].push(item);
        }
      }

      const news = Object.values(newsByTopic).flat();

      if (news.length === 0) {
        console.log(`[NewsletterSend] No new news after filtering for subscriber ${subscriber.id}, skipping`);
        skipCount++;
        continue;
      }

      const topicsWithNews = Object.keys(newsByTopic);
      const topicsWithoutNews = subscriber.topics.filter(
        (topic) => !newsByTopic[topic] || newsByTopic[topic].length === 0,
      );

      console.log(
        `[NewsletterSend] Topics summary for ${maskEmail(subscriber.email)} - with news: ${topicsWithNews.join(", ") || "none"}, without news: ${topicsWithoutNews.join(", ") || "none"}`,
      );

      console.log(`[NewsletterSend] Sending ${news.length} news items to ${maskEmail(subscriber.email)}`);

      // Generate unsubscribe URL - handle null token safely
      const unsubscribeToken = subscriber.unsubscribe_token || 'invalid';
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/newsletter-unsubscribe?token=${unsubscribeToken}`;

      // Send email
      const { error: emailError } = await resend.emails.send({
        from: "Notícias Temáticas <noreply@institutodedalus.com.br>",
        to: [subscriber.email],
        subject: `📰 Suas notícias de hoje - ${new Date().toLocaleDateString('pt-BR')}`,
        html: generateEmailHtml(news as NewsItem[], unsubscribeUrl),
      });

      if (emailError) {
        console.error(`[NewsletterSend] Error sending email to subscriber ${subscriber.id}:`, emailError);
        continue;
      }

      // Update last_sent_at
      const { error: updateError } = await supabase
        .from("newsletter_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", subscriber.id);

      if (updateError) {
        console.error(`[NewsletterSend] Error updating last_sent_at for subscriber ${subscriber.id}:`, updateError);
      }

      sentCount++;
      console.log(`[NewsletterSend] Successfully sent to ${maskEmail(subscriber.email)}`);
    }

    console.log(`[NewsletterSend] Complete. Sent: ${sentCount}, Skipped: ${skipCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        skipped: skipCount,
        total: subscribers.length 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NewsletterSend] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao enviar newsletter" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
