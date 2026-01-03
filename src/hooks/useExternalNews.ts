import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Topic } from '@/lib/news/types';

export type NewsSource = 'newsdata' | 'worldnews';

interface ExternalNewsParams {
  source: NewsSource;
  query: string;
  topic?: Topic;
}

export function useExternalNews({ source, query, topic }: ExternalNewsParams) {
  return useQuery({
    queryKey: ['external-news', source, query, topic],
    queryFn: async () => {
      console.log('[useExternalNews] Fetching', { source, query, topic });

      const functionName = source === 'newsdata' ? 'fetch-newsdata' : 'fetch-worldnews';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { query, topic },
      });

      if (error) {
        console.error('[useExternalNews] Error', error);
        throw error;
      }

      console.log('[useExternalNews] Success', { count: data.news?.length });
      return data.news;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    enabled: Boolean(query), // Only run if query is provided
  });
}
