import { useMemo, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NewsList } from '@/components/news/NewsList';
import { SEO } from '@/components/SEO';
import { useInfiniteNews } from '@/hooks/useInfiniteNews';
import { useRefreshNews } from '@/hooks/useNews';
import { useNewsSearch } from '@/context/NewsSearchContext';
import { FunFactWidget } from '@/components/news/FunFactWidget';
 
export default function NewsIndex() {
  const { query: searchQuery, setQuery: setSearchQuery } = useNewsSearch();
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
    console.log('[NewsIndex] Mounted, checking for refresh');
    triggerRefresh();
  }, [triggerRefresh]);

  const allNews = useMemo(() => {
    return data?.pages.flatMap(page => page.news) || [];
  }, [data]);

  if (error) {
    return (
      <div className="space-y-6">
        <SEO title="Todas as Notícias" />
        <h1 className="text-3xl font-bold">Todas as Notícias</h1>
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
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="Boletim – Todas as Notícias"
        description="Boletim, comunidade interna da plataforma Conexões do Saber, reúne as últimas notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia."
      />

      <header>
        <h1 className="text-3xl font-bold">Boletim – Todas as Notícias</h1>
        <p className="text-muted-foreground mt-2">
          Explore as últimas notícias temáticas do Boletim, a área de comunidade e atualização contínua da plataforma
          Conexões do Saber.
        </p>
      </header>

      <FunFactWidget />

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        {searchQuery && (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {allNews.length} {allNews.length === 1 ? 'resultado' : 'resultados'} para "{searchQuery}"
          </p>
        )}
      </div>
      
      <NewsList 
        news={allNews} 
        isLoading={isLoading} 
        showTopic={true}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
}
