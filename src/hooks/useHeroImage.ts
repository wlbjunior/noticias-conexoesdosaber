import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewsItem } from '@/lib/news/types';

interface HeroImageResult {
  imageUrl: string;
  prompt: string;
}

export function useHeroImage(news: NewsItem | null) {
  return useQuery({
    queryKey: ['hero-image', news?.id],
    queryFn: async (): Promise<HeroImageResult | null> => {
      if (!news) return null;

      console.log('[useHeroImage] Generating image for:', news.title);

      const { data, error } = await supabase.functions.invoke('generate-hero-image', {
        body: {
          title: news.title,
          description: news.description,
          topic: news.topic,
        },
      });

      if (error) {
        console.error('[useHeroImage] Error:', error);
        throw error;
      }

      console.log('[useHeroImage] Image generated successfully');
      return data as HeroImageResult;
    },
    enabled: Boolean(news?.id),
    staleTime: 1000 * 60 * 60, // 1 hour - cache the generated image
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
}
