import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { NewsItem } from '@/lib/news/types';
import { NewsCard } from './NewsCard';
import { NewsCardSkeleton } from './NewsCardSkeleton';

interface NewsListProps {
  news: NewsItem[];
  isLoading?: boolean;
  showTopic?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function NewsList({ 
  news, 
  isLoading = false, 
  showTopic = true,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: NewsListProps) {
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [target] = entries;
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  if (isLoading) {
    return (
      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
        role="status" 
        aria-label="Carregando notícias"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <NewsCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <p className="text-muted-foreground text-lg">
          Nenhuma notícia encontrada.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none p-0"
        role="list"
        aria-label="Lista de notícias"
      >
        {news.map((item, index) => (
          <li key={item.id}>
            <NewsCard 
              news={item} 
              showTopic={showTopic} 
              animationDelay={Math.min(index * 50, 500)} 
            />
          </li>
        ))}
      </ul>
      
      {/* Infinite scroll trigger */}
      <div 
        ref={loadMoreRef} 
        className="flex justify-center py-8"
        aria-hidden={!hasNextPage}
      >
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span>Carregando mais notícias...</span>
          </div>
        )}
      </div>
    </div>
  );
}
