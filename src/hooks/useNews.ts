import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewsItem, Topic } from '@/lib/news/types';
import { logger } from '@/lib/logger';

export function useNews(topic?: Topic) {
  return useQuery({
    queryKey: ['news', topic],
    queryFn: async () => {
      logger.log('[useNews] Fetching news', { topic });
      
      let query = supabase
        .from('news')
        .select('*')
        .eq('status', 'publicada')
        .order('published_at', { ascending: false });
      
      if (topic) {
        query = query.eq('topic', topic).limit(5);
      } else {
        query = query.limit(25);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('[useNews] Error', error);
        throw error;
      }
      
      logger.log('[useNews] Success', { count: data?.length });
      return data as NewsItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNewsById(id: string) {
  return useQuery({
    queryKey: ['news', 'detail', id],
    queryFn: async () => {
      logger.log('[useNewsById] Fetching', { id });
      
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        logger.error('[useNewsById] Error', error);
        throw error;
      }
      
      logger.log('[useNewsById] Success', data);
      return data as NewsItem | null;
    },
  });
}

/** Última coleta bem-sucedida, derivada do registro real de chamadas de integração. */
export function useLastNewsRefresh() {
  return useQuery({
    queryKey: ['news', 'last-refresh'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('last_news_refresh_at');
      if (error) {
        logger.error('[useLastNewsRefresh] Error', error);
        throw error;
      }
      return data ? new Date(data) : null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
