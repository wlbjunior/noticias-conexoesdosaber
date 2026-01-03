import { supabase } from "@/integrations/supabase/client";

export function useNewsClick() {
  const trackClick = async (newsId: string, topic: string) => {
    try {
      console.log("[useNewsClick] Tracking click", { newsId, topic });
      
      const { error } = await supabase
        .from("news_clicks")
        .insert({ news_id: newsId, topic });
      
      if (error) {
        console.error("[useNewsClick] Error tracking click", error);
      }
    } catch (error) {
      // Don't throw - click tracking is non-critical
      console.error("[useNewsClick] Exception", error);
    }
  };

  return { trackClick };
}
