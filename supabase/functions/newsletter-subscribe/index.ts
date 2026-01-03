import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

interface SubscribeRequest {
  email: string;
  topics: string[];
}

// Simple hash function for IP addresses
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIP = req.headers.get("x-real-ip");
    const clientIP = forwardedFor?.split(",")[0].trim() || realIP || "unknown";
    const ipHash = hashIP(clientIP);

    console.log("[NewsletterAPI] New subscription request from IP hash:", ipHash);

    // Create Supabase client with service role for rate limit table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limit (max 5 attempts per hour per IP)
    const { data: rateLimit } = await supabase
      .from("newsletter_rate_limits")
      .select("*")
      .eq("ip_hash", ipHash)
      .maybeSingle();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    if (rateLimit) {
      const firstAttempt = new Date(rateLimit.first_attempt_at);
      
      // Reset if first attempt was more than an hour ago
      if (firstAttempt < oneHourAgo) {
        await supabase
          .from("newsletter_rate_limits")
          .update({
            attempts: 1,
            first_attempt_at: now.toISOString(),
            last_attempt_at: now.toISOString(),
          })
          .eq("ip_hash", ipHash);
      } else if (rateLimit.attempts >= 5) {
        console.warn("[NewsletterAPI] Rate limit exceeded for IP hash:", ipHash);
        return new Response(
          JSON.stringify({ error: "Muitas tentativas. Tente novamente em uma hora." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Increment attempts
        await supabase
          .from("newsletter_rate_limits")
          .update({
            attempts: rateLimit.attempts + 1,
            last_attempt_at: now.toISOString(),
          })
          .eq("ip_hash", ipHash);
      }
    } else {
      // Create new rate limit record
      await supabase
        .from("newsletter_rate_limits")
        .insert({
          ip_hash: ipHash,
          attempts: 1,
          first_attempt_at: now.toISOString(),
          last_attempt_at: now.toISOString(),
        });
    }

    const { email, topics }: SubscribeRequest = await req.json();
    
    console.log("[NewsletterAPI] Processing subscription", { email: email ? "[REDACTED]" : "missing", topicCount: topics?.length });

    // Validate email with proper regex and length limit
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = email?.trim().toLowerCase();
    
    if (!trimmedEmail || !emailRegex.test(trimmedEmail) || trimmedEmail.length > 255) {
      console.warn("[NewsletterAPI] Invalid email format received");
      return new Response(
        JSON.stringify({ error: "E-mail inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate topics
    const validTopics = ["mitologia", "filosofia", "religiao", "artes", "psicologia"];
    const selectedTopics = topics.filter((t) => validTopics.includes(t));
    
    if (selectedTopics.length === 0) {
      // Default to all topics
      selectedTopics.push(...validTopics);
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from("newsletter_subscriptions")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (existing) {
      // Update existing subscription
      const { error } = await supabase
        .from("newsletter_subscriptions")
        .update({ topics: selectedTopics })
        .eq("email", trimmedEmail);

      if (error) throw error;
      
      console.log("[NewsletterAPI] Updated existing subscription");
    } else {
      // Create new subscription
      const { error } = await supabase
        .from("newsletter_subscriptions")
        .insert({ email: trimmedEmail, topics: selectedTopics });

      if (error) throw error;
      
      console.log("[NewsletterAPI] Created new subscription");
    }

    // Cleanup old rate limits periodically (1% chance per request)
    if (Math.random() < 0.01) {
      try {
        await supabase.rpc("cleanup_old_rate_limits");
      } catch {
        // Non-critical, ignore errors
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Inscrição realizada com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NewsletterAPI] Error", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar inscrição" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
