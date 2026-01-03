import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        generateHtml("Erro", "Token de cancelamento inválido.", false),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    console.log("[NewsletterUnsubscribe] Processing unsubscribe request");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find and delete subscription
    const { data: subscription, error: findError } = await supabase
      .from("newsletter_subscriptions")
      .select("email")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (findError || !subscription) {
      console.error("[NewsletterUnsubscribe] Subscription not found:", findError);
      return new Response(
        generateHtml("Erro", "Inscrição não encontrada ou já cancelada.", false),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const { error: deleteError } = await supabase
      .from("newsletter_subscriptions")
      .delete()
      .eq("unsubscribe_token", token);

    if (deleteError) {
      console.error("[NewsletterUnsubscribe] Error deleting subscription:", deleteError);
      throw deleteError;
    }

    console.log("[NewsletterUnsubscribe] Successfully unsubscribed:", subscription.email);

    return new Response(
      generateHtml("Inscrição Cancelada", "Você foi removido da nossa lista de newsletter com sucesso.", true),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("[NewsletterUnsubscribe] Error:", error);
    return new Response(
      generateHtml("Erro", "Ocorreu um erro ao processar sua solicitação.", false),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});

function generateHtml(title: string, message: string, success: boolean): string {
  const iconColor = success ? "#22c55e" : "#ef4444";
  const icon = success ? "✓" : "✕";
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Notícias Temáticas</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          max-width: 400px;
        }
        .icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: ${iconColor};
          color: white;
          font-size: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        h1 { color: #1a1a1a; margin: 0 0 16px; font-size: 24px; }
        p { color: #666; margin: 0; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}
