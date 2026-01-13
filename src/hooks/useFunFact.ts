import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface FunFact {
  fact: string;
  category?: string;
  language?: string;
}

export function useFunFact() {
  return useQuery({
    queryKey: ['fun-fact'],
    queryFn: async () => {
      logger.log('[useFunFact] Fetching daily fun fact');

      const { data, error } = await supabase.functions.invoke('fetch-fun-fact');

      if (error) {
        logger.error('[useFunFact] Error', error);
        throw error;
      }

      logger.log('[useFunFact] Success', data);
      return data.fact as FunFact;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - refresh once per day
    refetchOnWindowFocus: false,
  });
}
