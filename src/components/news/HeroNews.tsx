import { memo, useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Clock, Sparkles, ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewsItem, getTopicStyle } from '@/lib/news/types';
import { useNewsClick } from '@/hooks/useNewsClick';
import { useHeroImage } from '@/hooks/useHeroImage';
import { cn } from '@/lib/utils';

interface HeroNewsProps {
  news: NewsItem;
}

function HeroNewsComponent({ news }: HeroNewsProps) {
  const topicStyle = getTopicStyle(news.topic);
  const publishedDate = new Date(news.published_at);
  const { trackClick } = useNewsClick();
  const { data: heroImageData, isLoading: isGeneratingImage } = useHeroImage(news);
  
  // Parallax effect
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          setScrollY(window.scrollY * 0.3);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate reading time (rough estimate)
  const readingTime = Math.max(2, Math.ceil((news.description?.length || 100) / 200));

  const handleClick = () => {
    trackClick(news.id, news.topic);
  };

  // Use AI-generated image if available, otherwise fall back to original or gradient
  const displayImageUrl = heroImageData?.imageUrl || news.image_url;

  return (
    <section 
      ref={heroRef}
      className="relative overflow-hidden rounded-xl mb-8 animate-fade-in"
    >
      {/* Background image with gradient overlay and parallax */}
      <div className="relative h-[400px] sm:h-[450px] lg:h-[500px] overflow-hidden">
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={`Imagem: ${news.title}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-100"
            style={{ transform: `translateY(${scrollY}px) scale(1.1)` }}
            loading="eager"
          />
        ) : (
          <div 
            className={cn(
              'absolute inset-0',
              `gradient-${news.topic}`
            )}
            style={{ transform: `translateY(${scrollY * 0.5}px)` }}
          />
        )}
        
        {/* AI Image loading indicator */}
        {isGeneratingImage && !displayImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Gerando imagem com IA...</span>
            </div>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-hero" />
        
        {/* Decorative elements */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {heroImageData?.imageUrl && (
            <Badge 
              variant="secondary" 
              className="glass-card backdrop-blur-md px-3 py-1 text-xs font-medium"
            >
              <ImageIcon className="w-3 h-3 mr-1" />
              Gerada por IA
            </Badge>
          )}
          <Badge 
            variant="secondary" 
            className="glass-card backdrop-blur-md px-3 py-1 text-xs font-medium animate-pulse-soft"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Destaque
          </Badge>
        </div>
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-10">
          <div className="max-w-3xl space-y-4 animate-slide-up">
            {/* Topic badge */}
            <Badge 
              className={cn(
                topicStyle.bgClass,
                topicStyle.textClass,
                'border-0 backdrop-blur-sm transition-all duration-300 hover:scale-105'
              )}
            >
              <span className="mr-1">{topicStyle.icon}</span>
              {topicStyle.label}
            </Badge>
            
            {/* Title */}
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight line-clamp-3 drop-shadow-lg">
              {news.title}
            </h2>
            
            {/* Description */}
            {news.description && (
              <p className="text-white/90 text-sm sm:text-base line-clamp-2 max-w-2xl">
                {news.description}
              </p>
            )}
            
            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <time dateTime={news.published_at} className="flex items-center gap-1">
                {format(publishedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </time>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {readingTime} min de leitura
              </span>
              {news.source_name && (
                <span className="text-white/60">
                  {news.source_name}
                </span>
              )}
            </div>
            
            {/* CTA Button */}
            {news.source_url && (
              <Button 
                asChild 
                size="lg"
                className="w-fit mt-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <a 
                  href={news.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={handleClick}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ler notícia completa
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const HeroNews = memo(HeroNewsComponent);
