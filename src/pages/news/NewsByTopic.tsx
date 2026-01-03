import { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NewsList } from '@/components/news/NewsList';
import { SEO } from '@/components/SEO';
import { Topic, TOPICS, topicStyles } from '@/lib/news/types';
import { useInfiniteNews } from '@/hooks/useInfiniteNews';
import { useNewsSearch } from '@/context/NewsSearchContext';
 
export default function NewsByTopic() {
  const { topic } = useParams<{ topic: string }>();
  const { query: searchQuery, setQuery: setSearchQuery } = useNewsSearch();
  
  // Validate topic
  if (!topic || !TOPICS.includes(topic as Topic)) {
    return <Navigate to="/news" replace />;
  }

  const validTopic = topic as Topic;
  const style = topicStyles[validTopic];

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteNews(validTopic, searchQuery);

  const allNews = useMemo(() => {
    return data?.pages.flatMap(page => page.news) || [];
  }, [data]);

  if (error) {
    return (
      <div className="space-y-6">
        <SEO title={style.label} />
        <h1 className="text-3xl font-bold" style={{ color: style.color }}>{style.label}</h1>
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Não foi possível carregar as notícias.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SEO title={style.label} description={`Notícias sobre ${style.label}`} />
      <header className="flex items-center gap-3">
        <div className="h-8 w-2 rounded-full" style={{ backgroundColor: style.color }} />
        <h1 className="text-3xl font-bold">{style.label}</h1>
      </header>
      <NewsList 
        news={allNews} 
        isLoading={isLoading} 
        showTopic={false}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
      />
    </div>
  );
}
