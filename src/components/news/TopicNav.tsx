import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Topic, TOPICS, topicStyles } from '@/lib/news/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function TopicNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <nav className="flex items-center gap-3 py-3" aria-label="Navegação por temas">
        {/* Geral link */}
        <Link
          to="/news"
          aria-current={isActive('/news') ? 'page' : undefined}
          className={cn(
            'group relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'hover:scale-105 active:scale-95',
            isActive('/news')
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <span className="relative z-10 flex items-center gap-2">
            <span className="text-base">📰</span>
            Geral
          </span>
          {/* Glow effect on active */}
          {isActive('/news') && (
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-soft" />
          )}
        </Link>

        {/* Topic links */}
        {TOPICS.map((topic) => {
          const style = topicStyles[topic];
          const path = `/news/topic/${topic}`;
          const active = isActive(path);
          
          return (
            <Link
              key={topic}
              to={path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'hover:scale-105 active:scale-95',
                active
                  ? cn(
                      style.bgClass,
                      style.textClass,
                      'ring-2 ring-offset-2 ring-offset-background shadow-lg'
                    )
                  : 'bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
              style={active ? { 
                '--tw-ring-color': style.color,
                boxShadow: `0 4px 20px ${style.color}40`
              } as React.CSSProperties : undefined}
            >
              <span className="relative z-10 flex items-center gap-2">
                <span 
                  className={cn(
                    'text-base transition-transform duration-300',
                    active ? 'animate-float' : 'group-hover:scale-110'
                  )}
                >
                  {style.icon}
                </span>
                {style.label}
              </span>
              
              {/* Hover gradient effect */}
              <span 
                className={cn(
                  'absolute inset-0 rounded-full opacity-0 transition-opacity duration-300',
                  'group-hover:opacity-10',
                  style.gradientClass
                )}
              />
              
              {/* Active glow pulse */}
              {active && (
                <span 
                  className="absolute inset-0 rounded-full animate-pulse-soft"
                  style={{ 
                    background: `${style.color}20`
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" className="h-1.5" />
    </ScrollArea>
  );
}
