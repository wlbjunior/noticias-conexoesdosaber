import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization for cron jobs
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("NEWSLETTER_CRON_SECRET");
    
    // Allow service role or cron secret
    const isAuthorized = authHeader?.includes("service_role") || 
                         authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized) {
      console.log("[CleanupDiscardedNews] Unauthorized request");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get retention days from request body or use default (7 days)
    let retentionDays = 7;
    try {
      const body = await req.json();
      if (body.retentionDays && typeof body.retentionDays === "number") {
        retentionDays = body.retentionDays;
      }
    } catch {
      // Use default if no body or invalid JSON
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`[CleanupDiscardedNews] Deleting discarded news older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    // Delete discarded news older than retention period that were not restored
    const { data, error, count } = await supabase
      .from("discarded_news")
      .delete()
      .eq("restored", false)
      .lt("discarded_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      console.error("[CleanupDiscardedNews] Error deleting:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deletedCount = data?.length || 0;
    console.log(`[CleanupDiscardedNews] Successfully deleted ${deletedCount} discarded news items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[CleanupDiscardedNews] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
