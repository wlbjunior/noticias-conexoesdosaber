import { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NewsList } from '@/components/news/NewsList';
import { HeroNews } from '@/components/news/HeroNews';
import { HeroNewsSkeleton } from '@/components/news/NewsCardSkeleton';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/layout/PageTransition';
import { Topic, TOPICS, getTopicStyle } from '@/lib/news/types';
import { useInfiniteNews } from '@/hooks/useInfiniteNews';
import { useNewsSearch } from '@/context/NewsSearchContext';

function NewsByTopicContent({ topic }: { topic: Topic }) {
  const { query: searchQuery } = useNewsSearch();
  const topicStyle = getTopicStyle(topic);

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteNews(topic, searchQuery);

  const allNews = useMemo(() => {
    return data?.pages.flatMap(page => page.news) || [];
  }, [data]);

  // Get hero news (most recent) and remaining news - only when not searching
  const heroNews = !searchQuery && allNews.length > 0 ? allNews[0] : null;
  const remainingNews = heroNews ? allNews.slice(1) : allNews;

  if (error) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <SEO title={`${topicStyle.label} - Notícias`} />
          <h1 className="font-serif text-3xl font-bold flex items-center gap-3">
            <span className="text-4xl">{topicStyle.icon}</span>
            {topicStyle.label}
          </h1>
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
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <SEO 
          title={`${topicStyle.label} - Notícias do Boletim`}
          description={`Acompanhe as últimas notícias sobre ${topicStyle.label} no Boletim, comunidade interna da plataforma Conexões do Saber.`}
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
          <h1 className="font-serif text-3xl font-bold flex items-center gap-3">
            <span 
              className="text-4xl animate-float"
              style={{ animationDelay: '0.2s' }}
            >
              {topicStyle.icon}
            </span>
            <span className={topicStyle.textClass}>{topicStyle.label}</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {searchQuery 
              ? `${allNews.length} ${allNews.length === 1 ? 'resultado' : 'resultados'} para "${searchQuery}" em ${topicStyle.label}`
              : `Explore as notícias sobre ${topicStyle.label.toLowerCase()}`
            }
          </p>
        </header>
        
        <NewsList 
          news={remainingNews} 
          isLoading={isLoading} 
          showTopic={false}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        />
      </div>
    </PageTransition>
  );
}
 
export default function NewsByTopic() {
  const { topic } = useParams<{ topic: string }>();
  
  // Validate topic
  if (!topic || !TOPICS.includes(topic as Topic)) {
    return <Navigate to="/news" replace />;
  }

  return <NewsByTopicContent topic={topic as Topic} />;
}
