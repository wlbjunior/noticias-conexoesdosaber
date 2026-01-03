import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, TrendingUp, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { topicStyles, Topic } from "@/lib/news/types";

interface TopicStat {
  topic: string;
  count: number;
}

interface NewsStat {
  news_id: string;
  count: number;
  title?: string;
  topic?: string;
  source_url?: string;
}

export function ReadingStats() {
  const { data: topicStats, isLoading: topicLoading } = useQuery({
    queryKey: ["stats", "topics"],
    queryFn: async () => {
      // Get click counts by topic
      const { data, error } = await supabase
        .from("news_clicks")
        .select("topic");
      
      if (error) throw error;
      
      // Aggregate by topic
      const counts: Record<string, number> = {};
      data?.forEach((click) => {
        counts[click.topic] = (counts[click.topic] || 0) + 1;
      });
      
      return Object.entries(counts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count) as TopicStat[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: newsStats, isLoading: newsLoading } = useQuery({
    queryKey: ["stats", "news"],
    queryFn: async () => {
      // Get top clicked news
      const { data: clicks, error: clicksError } = await supabase
        .from("news_clicks")
        .select("news_id, topic");
      
      if (clicksError) throw clicksError;
      
      // Aggregate by news_id
      const counts: Record<string, { count: number; topic: string }> = {};
      clicks?.forEach((click) => {
        if (!counts[click.news_id]) {
          counts[click.news_id] = { count: 0, topic: click.topic };
        }
        counts[click.news_id].count++;
      });
      
      // Get top 5 news IDs
      const topNewsIds = Object.entries(counts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id]) => id);
      
      if (topNewsIds.length === 0) return [];
      
      // Fetch news titles
      const { data: news, error: newsError } = await supabase
        .from("news")
        .select("id, title, topic, source_url")
        .in("id", topNewsIds);
      
      if (newsError) throw newsError;
      
      return topNewsIds.map((id) => {
        const newsItem = news?.find((n) => n.id === id);
        return {
          news_id: id,
          count: counts[id].count,
          title: newsItem?.title || "Notícia não encontrada",
          topic: newsItem?.topic || counts[id].topic,
          source_url: newsItem?.source_url,
        };
      }) as NewsStat[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const totalClicks = topicStats?.reduce((acc, stat) => acc + stat.count, 0) || 0;

  if (topicLoading || newsLoading) {
    return (
      <Card className="mt-4 border-border bg-card/70 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4" />
            Estatísticas de Leitura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 border-border bg-card/70 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Estatísticas de Leitura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Total clicks */}
        <div className="flex items-center gap-3 rounded-md bg-background/70 p-3">
          <MousePointerClick className="h-7 w-7 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold leading-none">{totalClicks}</p>
            <p className="text-[11px] text-muted-foreground">cliques totais</p>
          </div>
        </div>

        {/* Topics ranking */}
        {topicStats && topicStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Temas mais populares
            </h4>
            <div className="space-y-1.5">
              {topicStats.map((stat, index) => {
                const style = topicStyles[stat.topic as Topic];
                const percentage = totalClicks > 0 ? (stat.count / totalClicks) * 100 : 0;

                return (
                  <div key={stat.topic} className="flex items-center gap-2">
                    <span className="w-4 text-xs font-medium">{index + 1}.</span>
                    <Badge
                      variant="outline"
                      className={`${style?.bgClass} ${style?.textClass} border-0 px-2 py-0.5 text-[11px]`}
                    >
                      {style?.label || stat.topic}
                    </Badge>
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-1.5 ${style?.bgClass?.replace("/10", "/60")}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] text-muted-foreground">
                      {stat.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top news */}
        {newsStats && newsStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notícias mais acessadas
            </h4>
            <ol className="space-y-1.5 text-xs">
              {newsStats.map((stat, index) => {
                const style = topicStyles[stat.topic as Topic];
                const href = stat.source_url ?? "#";

                return (
                  <li key={stat.news_id} className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-semibold">{index + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 leading-snug text-foreground underline-offset-2 hover:underline"
                      >
                        {stat.title}
                      </a>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${style?.bgClass} ${style?.textClass} border-0 px-2 py-0.5 text-[11px]`}
                        >
                          {style?.label || stat.topic}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {stat.count} {stat.count === 1 ? "clique" : "cliques"}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {(!topicStats || topicStats.length === 0) && (!newsStats || newsStats.length === 0) && (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Nenhuma estatística disponível ainda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
