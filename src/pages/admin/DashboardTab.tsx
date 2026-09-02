import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Stats = {
  news_published: number;
  news_archived: number;
  collected_24h: number;
  new_24h: number;
  ingest_runs_24h: number;
  sources_active: number;
  sources_failing: number;
  avg_relevance: number | null;
  analysis_count: number;
  discarded_spam_24h: number;
  discarded_irrelevant_24h: number;
  pautas_open: number;
};

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as unknown as Stats;
    },
    staleTime: 60_000,
  });
}

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card className="border-border/60 bg-card/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardTab({ onGoToSources }: { onGoToSources: () => void }) {
  const { data: s, isLoading, error } = useDashboardStats();

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando…" />;
  if (error || !s) return <p className="text-sm text-destructive">Não foi possível carregar os indicadores do painel.</p>;

  return (
    <div className="space-y-4">
      {s.sources_failing > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {s.sources_failing} fonte{s.sources_failing === 1 ? "" : "s"} ativa{s.sources_failing === 1 ? "" : "s"} em falha
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>A última coleta dessas fontes terminou com erro.</span>
            <Button size="sm" variant="outline" onClick={onGoToSources}>
              Ver fontes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Notícias publicadas" value={String(s.news_published)} hint={`${s.news_archived} arquivadas`} />
        <StatCard
          title="Coletados nas últimas 24 h"
          value={s.ingest_runs_24h === 0 ? "sem coleta" : String(s.collected_24h)}
          hint={s.ingest_runs_24h === 0 ? "Nenhuma rodada de ingestão registrada no período." : `${s.new_24h} realmente novos`}
        />
        <StatCard
          title="Fontes ativas"
          value={String(s.sources_active)}
          hint={s.sources_failing > 0 ? `${s.sources_failing} em falha` : "Nenhuma em falha"}
        />
        <StatCard
          title="Relevância média (IA)"
          value={s.avg_relevance === null ? "sem análise" : `${s.avg_relevance}/100`}
          hint={s.analysis_count === 0 ? "Nenhuma notícia analisada ainda." : `${s.analysis_count} notícias analisadas`}
        />
        <StatCard
          title="Descartadas nas últimas 24 h"
          value={String(s.discarded_spam_24h + s.discarded_irrelevant_24h)}
          hint={`${s.discarded_spam_24h} spam · ${s.discarded_irrelevant_24h} irrelevantes para o tema`}
        />
        <StatCard title="Pautas em aberto" value={String(s.pautas_open)} hint="Sugeridas, aprovadas ou em produção" />
      </div>
    </div>
  );
}
