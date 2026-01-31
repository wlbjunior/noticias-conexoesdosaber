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
import { cn } from '@/lib/utils';

interface NewsCardProps {
  news: NewsItem;
  showTopic?: boolean;
  animationDelay?: number;
  variant?: 'default' | 'compact' | 'featured';
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

function NewsCardComponent({ news, showTopic = true, animationDelay = 0, variant = 'default' }: NewsCardProps) {
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
      className={cn(
        'group relative overflow-hidden transition-all duration-300 flex flex-col h-full',
        'hover:shadow-lg hover:-translate-y-1',
        'border-l-4',
        topicStyle.borderClass,
        'animate-fade-in opacity-0'
      )}
      style={{ 
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'forwards'
      }}
    >
      <NewBadge publishedAt={news.published_at} />
      
      {/* Image with overlay */}
      {news.image_url && (
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          <img
            src={news.image_url}
            alt={`Imagem ilustrativa: ${news.title}`}
            className="w-full h-full object-cover img-zoom"
            loading="lazy"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
          
          {/* Topic badge on image */}
          {showTopic && (
            <Badge 
              variant="outline" 
              className={cn(
                'absolute bottom-3 left-3 backdrop-blur-sm border-0',
                topicStyle.bgClass,
                topicStyle.textClass
              )}
            >
              <span className="mr-1 text-xs">{topicStyle.icon}</span>
              {topicStyle.label}
            </Badge>
          )}
        </div>
      )}
      
      <CardHeader className={cn("pb-2 flex-grow", !news.image_url && "pt-6")}>
        {/* Topic badge when no image */}
        {showTopic && !news.image_url && (
          <Badge 
            variant="outline" 
            className={cn(
              'w-fit border-0',
              topicStyle.bgClass,
              topicStyle.textClass
            )}
          >
            <span className="mr-1 text-xs">{topicStyle.icon}</span>
            {topicStyle.label}
          </Badge>
        )}
        
        {/* Title with serif font */}
        <h3 className="font-serif text-lg font-semibold leading-tight line-clamp-3 group-hover:text-primary transition-colors duration-200">
          {news.title}
        </h3>
        
        {/* Description removed per user request */}
        
        {/* Published date */}
        <div className="text-xs text-muted-foreground mt-3">
          <time dateTime={news.published_at}>
            {format(publishedDate, "dd MMM yyyy", { locale: ptBR })}
          </time>
        </div>
      </CardHeader>

      <CardContent className="pb-2 flex-shrink-0">
        {news.source_name && (
          <p className="text-xs text-muted-foreground truncate">
            Fonte: <span className="font-medium">{news.source_name}</span>
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-2 mt-auto flex-shrink-0">
        {news.source_url ? (
          <Button 
            variant="default" 
            size="sm" 
            asChild 
            className={cn(
              'w-full transition-all duration-300',
              'hover:shadow-md'
            )}
          >
            <a 
              href={news.source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={handleSourceClick}
              aria-label={`Ler notícia completa: ${news.title}`}
            >
              <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
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

export const NewsCard = memo(function NewsCard({ news, showTopic = true, animationDelay = 0, variant = 'default' }: NewsCardProps) {
  return <NewsCardComponent news={news} showTopic={showTopic} animationDelay={animationDelay} variant={variant} />;
});
