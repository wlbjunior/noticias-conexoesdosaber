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

export function useRefreshNews() {
  return useQuery({
    queryKey: ['news', 'refresh'],
    queryFn: async () => {
      logger.log('[useRefreshNews] Checking refresh status');
      
      const { data: control } = await supabase
        .from('news_refresh_control')
        .select('last_refresh_at')
        .limit(1)
        .maybeSingle();
      
      if (control) {
        const lastRefresh = new Date(control.last_refresh_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastRefresh.getTime()) / 1000 / 60;
        
        logger.log('[useRefreshNews] Last refresh was', diffMinutes.toFixed(0), 'minutes ago');
      }
      
      // News refresh is handled by cron job with NEWS_REFRESH_SECRET
      // Client only checks status, doesn't trigger refresh
      return true;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });
}
