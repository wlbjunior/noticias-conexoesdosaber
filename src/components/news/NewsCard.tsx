import React, { memo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewsItem, getTopicStyle } from '@/lib/news/types';
import { NewBadge } from './NewBadge';
import { useNewsClick } from '@/hooks/useNewsClick';
import { useToast } from '@/hooks/use-toast';

interface NewsCardProps {
  news: NewsItem;
  showTopic?: boolean;
  animationDelay?: number;
}

function isUnsafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const blockedHosts = ['www.a8n8m7.com', 'a8n8m7.com'];
    return blockedHosts.includes(parsed.hostname);
  } catch {
    return true;
  }
}

function NewsCardComponent({ news, showTopic = true, animationDelay = 0 }: NewsCardProps) {
  const topicStyle = getTopicStyle(news.topic);
  const publishedDate = new Date(news.published_at);
  const { trackClick } = useNewsClick();
  const { toast } = useToast();

  const handleSourceClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!news.source_url) return;

    if (isUnsafeUrl(news.source_url)) {
      event.preventDefault();
      toast({
        title: 'Link suspeito bloqueado',
        description: 'Bloqueamos esta fonte por parecer redirecionar para um site de jogo de azar.',
        variant: 'destructive',
      });
      return;
    }

    trackClick(news.id, news.topic);
  };
  return (
    <Card 
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-t-4 ${topicStyle.borderClass} flex flex-col min-h-[280px] h-full animate-fade-in`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <NewBadge publishedAt={news.published_at} />
      
      {news.image_url && (
        <div className="relative h-40 sm:h-48 overflow-hidden flex-shrink-0">
          <img
            src={news.image_url}
            alt={`Imagem ilustrativa: ${news.title}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}
      
      <CardHeader className="pb-2 flex-grow">
        {showTopic && (
          <Badge 
            variant="outline" 
            className={`w-fit ${topicStyle.bgClass} ${topicStyle.textClass} border-0`}
          >
            {topicStyle.label}
          </Badge>
        )}
        <h3 className="text-base sm:text-lg font-semibold leading-tight line-clamp-3 sm:line-clamp-4">
          {news.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-auto">
          <time dateTime={news.published_at}>
            {format(publishedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </time>
        </p>
      </CardHeader>

      <CardContent className="pb-2 flex-shrink-0">
        {news.source_name && (
          <p className="text-xs text-muted-foreground truncate">
            Fonte: {news.source_name}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-2 mt-auto flex-shrink-0">
        {news.source_url ? (
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="w-full"
          >
            <a 
              href={news.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleSourceClick}
              aria-label={`Ler notícia completa: ${news.title}`}
            >
              <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />
              Ler na fonte
            </a>
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            disabled
          >
            Conteúdo interno
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export const NewsCard = memo(function NewsCard({ news, showTopic = true, animationDelay = 0 }: NewsCardProps) {
  return <NewsCardComponent news={news} showTopic={showTopic} animationDelay={animationDelay} />;
});
