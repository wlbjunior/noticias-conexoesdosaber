import { useParams, Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ExternalLink, Calendar, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNewsById } from '@/hooks/useNews';
import { getTopicStyle } from '@/lib/news/types';

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: news, isLoading, error } = useNewsById(id || '');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !news) {
    return <Navigate to="/news" replace />;
  }

  const topicStyle = getTopicStyle(news.topic);
  const publishedDate = new Date(news.published_at);

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" asChild>
        <Link to="/news">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para notícias
        </Link>
      </Button>

      <article className="space-y-6">
        {news.image_url && (
          <div className="relative rounded-2xl overflow-hidden">
            <img
              src={news.image_url}
              alt={news.title}
              className="w-full h-64 md:h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        <div className="space-y-4">
          <Badge 
            variant="outline" 
            className={`${topicStyle.bgClass} ${topicStyle.textClass} border-0`}
          >
            {topicStyle.label}
          </Badge>

          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            {news.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(publishedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            {news.source_name && (
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>{news.source_name}</span>
              </div>
            )}
          </div>
        </div>

        {news.description && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">{news.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-4">
          <Button asChild size="lg">
            <a href={news.source_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ler artigo completo na fonte
            </a>
          </Button>
          {news.full_article_url && news.full_article_url !== news.source_url && (
            <Button variant="outline" asChild size="lg">
              <a href={news.full_article_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Link alternativo
              </a>
            </Button>
          )}
        </div>
      </article>
    </div>
  );
}
