import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem, Topic } from "@/lib/news/types";

const PAGE_SIZE = 12;

export function useInfiniteNews(topic?: Topic, searchQuery?: string) {
  return useInfiniteQuery({
    queryKey: ["news", "infinite", topic, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      console.log("[useInfiniteNews] Fetching page", { pageParam, topic, searchQuery });

      let externalQuery = supabase
        .from("news")
        .select("*")
        .order("published_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (topic) {
        externalQuery = externalQuery.eq("topic", topic);
      }

      if (searchQuery && searchQuery.trim()) {
        externalQuery = externalQuery.ilike("title", `%${searchQuery.trim()}%`);
      }

      const { data: externalData, error: externalError } = await externalQuery;

      if (externalError) {
        console.error("[useInfiniteNews] Error (external)", externalError);
        throw externalError;
      }

      let internalNews: NewsItem[] = [];

      // Mix published internal news into the first page of the feed
      if (pageParam === 0) {
        let internalQuery = supabase
          .from("internal_news")
          .select("*")
          .eq("status", "publicado")
          .not("published_at", "is", null)
          .order("published_at", { ascending: false });

        if (topic) {
          internalQuery = internalQuery.eq("topic", topic);
        }

        const { data: internalData, error: internalError } = await internalQuery;

        if (internalError) {
          console.error("[useInfiniteNews] Error (internal)", internalError);
        } else if (internalData) {
          internalNews = internalData.map((item: any) => ({
            id: item.id,
            topic: item.topic,
            title: item.title,
            description: item.body,
            source_name: "Boletim interno",
            source_url: "",
            full_article_url: null,
            published_at: item.published_at,
            fetched_at: item.created_at,
            image_url: null,
            created_at: item.created_at,
            // Carry pin information for sorting (not part of NewsItem type)
            is_pinned: item.is_pinned,
          })) as NewsItem[];
        }
      }

      const allNews = [...(externalData as NewsItem[]), ...internalNews].sort((a, b) => {
        const aPinned = (a as any).is_pinned === true;
        const bPinned = (b as any).is_pinned === true;

        if (aPinned !== bPinned) {
          return aPinned ? -1 : 1;
        }

        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });

      console.log("[useInfiniteNews] Success", {
        externalCount: externalData?.length,
        internalCount: internalNews.length,
        totalCount: allNews.length,
        page: pageParam,
      });

      return {
        news: allNews,
        // Pagination is based only on external news; internal news are a fixed set mixed into page 0
        nextPage: externalData?.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
