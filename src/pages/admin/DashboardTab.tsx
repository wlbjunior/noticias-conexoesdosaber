import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, Loader2, Sparkles, TimerOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { formatDateTime } from "./admin-utils";

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
  last_published_at: string | null;
  ai_last_http_status: number | null;
  ai_last_ok: boolean | null;
  ai_last_called_at: string | null;
  pending_analysis: number;
  pending_analysis_stale: number;
  last_briefing_at: string | null;
};

const STALE_HOURS = 48;

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

type PendingResult = { analyzed: number; published: number; error: string | null; httpStatus: number | null };

/** Botão "Classificar pendentes": roda só a IA sobre o acúmulo, sem nova coleta. */
export function ClassifyPendingButton({ onDone }: { onDone?: (r: PendingResult) => void }) {
  const [running, setRunning] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handle = async () => {
    setRunning(true);
    const startedAt = new Date().toISOString();
    try {
      const { error } = await supabase.functions.invoke("fetch-news", { body: { action: "classify_pending" } });
      if (error) throw error;
      toast({ title: "Classificação iniciada", description: "Processando o acúmulo em lotes…" });
      const deadline = Date.now() + 8 * 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 6000));
        const { data: rows } = await supabase
          .from("integration_calls")
          .select("ok, http_status, items_in, items_new, error")
          .eq("integration", "ingestao")
          .eq("endpoint", "classificar_pendentes")
          .gt("called_at", startedAt)
          .order("called_at", { ascending: false })
          .limit(1);
        const row = rows?.[0];
        if (row) {
          const result: PendingResult = { analyzed: row.items_in ?? 0, published: row.items_new ?? 0, error: row.ok ? null : row.error, httpStatus: row.http_status };
          onDone?.(result);
          toast({
            title: row.ok ? "Classificação concluída" : "A IA falhou",
            description: row.ok ? `${result.analyzed} analisadas · ${result.published} publicadas · ${row.error ?? ""}` : row.error ?? `HTTP ${row.http_status}`,
            variant: row.ok ? "default" : "destructive",
          });
          break;
        }
      }
    } catch (e) {
      logger.error("[Admin] Erro ao classificar pendentes", e);
      toast({ title: "Erro ao iniciar classificação", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handle} disabled={running}>
      {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />}
      {running ? "Classificando…" : "Classificar pendentes"}
    </Button>
  );
}

export function DashboardTab({ onGoToSources }: { onGoToSources: () => void }) {
  const { data: s, isLoading, error } = useDashboardStats();

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando…" />;
  if (error || !s) return <p className="text-sm text-destructive">Não foi possível carregar os indicadores do painel.</p>;

  const hoursSincePublish = s.last_published_at ? (Date.now() - new Date(s.last_published_at).getTime()) / 3_600_000 : null;
  const isStale = hoursSincePublish === null || hoursSincePublish > STALE_HOURS;
  const staleDays = hoursSincePublish === null ? null : Math.floor(hoursSincePublish / 24);
  const aiNoCredits = s.ai_last_ok === false && s.ai_last_http_status === 402;
  const hasPendingStale = s.pending_analysis_stale > 0;

  return (
    <div className="space-y-4">
      {isStale && (
        <Alert variant="destructive">
          <TimerOff className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {staleDays === null ? "O site nunca publicou nada." : `O site não publica nada há ${staleDays} dia${staleDays === 1 ? "" : "s"}.`}
          </AlertTitle>
          <AlertDescription>
            Última notícia publicada: {formatDateTime(s.last_published_at)}. Os avisos abaixo explicam a causa provável; este detecta o sintoma.
          </AlertDescription>
        </Alert>
      )}

      {aiNoCredits && (
        <Alert variant="destructive">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>A IA está sem créditos. Nenhuma notícia nova será publicada até isso ser resolvido.</AlertTitle>
          <AlertDescription>
            Última tentativa em {formatDateTime(s.ai_last_called_at)}. Adicione créditos de IA no workspace e use “Classificar pendentes” para destravar o acúmulo.
          </AlertDescription>
        </Alert>
      )}

      {hasPendingStale && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {s.pending_analysis_stale} notícia{s.pending_analysis_stale === 1 ? "" : "s"} coletada{s.pending_analysis_stale === 1 ? "" : "s"} aguarda{s.pending_analysis_stale === 1 ? "" : "m"} classificação.
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Há mais de 24 h sem análise da IA ({s.pending_analysis} no total). Classificar publica as que passarem no filtro.</span>
            <ClassifyPendingButton />
          </AlertDescription>
        </Alert>
      )}

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
        <StatCard title="Notícias publicadas" value={String(s.news_published)} hint={`${s.news_archived} arquivadas · última em ${formatDateTime(s.last_published_at)}`} />
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
          hint={s.analysis_count === 0 ? "Nenhuma notícia analisada ainda." : `${s.analysis_count} analisadas · ${s.pending_analysis} aguardando`}
        />
        <StatCard
          title="Descartadas nas últimas 24 h"
          value={String(s.discarded_spam_24h + s.discarded_irrelevant_24h)}
          hint={`${s.discarded_spam_24h} spam · ${s.discarded_irrelevant_24h} irrelevantes para o tema`}
        />
        <StatCard title="Pautas em aberto" value={String(s.pautas_open)} hint="Sugeridas, aprovadas ou em produção" />
        <StatCard title="Último briefing enviado" value={s.last_briefing_at ? formatDateTime(s.last_briefing_at) : "nunca"} hint="Envio diário às 8h (Brasília) para assinantes confirmados" />
      </div>
    </div>
  );
}
