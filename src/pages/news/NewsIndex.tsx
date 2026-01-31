import { useMemo, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NewsList } from '@/components/news/NewsList';
import { HeroNews } from '@/components/news/HeroNews';
import { HeroNewsSkeleton } from '@/components/news/NewsCardSkeleton';
import { SEO } from '@/components/SEO';
import { useInfiniteNews } from '@/hooks/useInfiniteNews';
import { useRefreshNews } from '@/hooks/useNews';
import { useNewsSearch } from '@/context/NewsSearchContext';
import { logger } from '@/lib/logger';


export default function NewsIndex() {
  const { query: searchQuery } = useNewsSearch();
  const { refetch: triggerRefresh } = useRefreshNews();
  
  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteNews(undefined, searchQuery);

  useEffect(() => {
    logger.log('[NewsIndex] Mounted, checking for refresh');
    triggerRefresh();
  }, [triggerRefresh]);

  const allNews = useMemo(() => {
    return data?.pages.flatMap(page => page.news) || [];
  }, [data]);

  // Get hero news (most recent) and remaining news
  const heroNews = !searchQuery && allNews.length > 0 ? allNews[0] : null;
  const remainingNews = heroNews ? allNews.slice(1) : allNews;

  if (error) {
    return (
      <div className="space-y-6">
        <SEO title="Todas as Notícias" />
        <h1 className="font-serif text-3xl font-bold">Todas as Notícias</h1>
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Não foi possível carregar as notícias. Tente novamente em alguns instantes.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Boletim – Todas as Notícias"
        description="Boletim, comunidade interna da plataforma Conexões do Saber, reúne as últimas notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia."
      />

      {/* Hero Section - only show when not searching */}
      {!searchQuery && (
        isLoading ? (
          <HeroNewsSkeleton />
        ) : heroNews ? (
          <HeroNews news={heroNews} />
        ) : null
      )}

      <header className="animate-fade-in">
        <h1 className="font-serif text-3xl font-bold">
          {searchQuery ? 'Resultados da Busca' : 'Últimas Notícias'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {searchQuery 
            ? `${allNews.length} ${allNews.length === 1 ? 'resultado' : 'resultados'} para "${searchQuery}"`
            : 'Explore as últimas notícias temáticas do Boletim'
          }
        </p>
      </header>
      
      <NewsList 
        news={remainingNews} 
        isLoading={isLoading} 
        showTopic={true}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
}
