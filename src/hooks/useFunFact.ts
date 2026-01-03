import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FunFact {
  fact: string;
  category?: string;
  language?: string;
}

export function useFunFact() {
  return useQuery({
    queryKey: ['fun-fact'],
    queryFn: async () => {
      console.log('[useFunFact] Fetching daily fun fact');

      const { data, error } = await supabase.functions.invoke('fetch-fun-fact');

      if (error) {
        console.error('[useFunFact] Error', error);
        throw error;
      }

      console.log('[useFunFact] Success', data);
      return data.fact as FunFact;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - refresh once per day
    refetchOnWindowFocus: false,
  });
}
