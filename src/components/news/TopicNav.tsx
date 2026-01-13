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
      <nav className="flex items-center gap-2 py-2" aria-label="Navegação por temas">
        <Link
          to="/news"
          aria-current={isActive('/news') ? 'page' : undefined}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isActive('/news')
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
          )}
        >
          Geral
        </Link>
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
                'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? `${style.bgClass} ${style.textClass} ring-2 ring-offset-2 ring-offset-background`
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              )}
              style={active ? { '--tw-ring-color': style.color } as React.CSSProperties : undefined}
            >
              {style.label}
            </Link>
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
