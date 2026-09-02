import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { INTEGRATION_META, formatDateTime, formatDuration } from "./admin-utils";

type Summary = {
  integration: string;
  total_calls: number;
  avg_duration_ms: number | null;
  last_called_at: string;
  last_ok: boolean;
  last_http_status: number | null;
  last_error: string | null;
  total_items_in: number;
  total_items_new: number;
};

type Call = {
  id: string;
  called_at: string;
  integration: string;
  endpoint: string;
  method: string;
  http_status: number | null;
  ok: boolean;
  items_in: number | null;
  items_new: number | null;
  duration_ms: number | null;
  error: string | null;
};

const KNOWN = ["google_news_rss", "rss", "lovable_ai", "ingestao"];

function useIntegrations() {
  return useQuery({
    queryKey: ["admin", "integrations"],
    queryFn: async () => {
      const [summaryRes, callsRes] = await Promise.all([
        supabase.rpc("admin_integration_summary"),
        supabase.from("integration_calls").select("*").order("called_at", { ascending: false }).limit(200),
      ]);
      if (summaryRes.error) throw summaryRes.error;
      if (callsRes.error) throw callsRes.error;
      return { summary: (summaryRes.data ?? []) as Summary[], calls: (callsRes.data ?? []) as Call[] };
    },
    staleTime: 30_000,
  });
}

type State = "ok" | "erro" | "nunca";

function StateBadge({ state }: { state: State }) {
  if (state === "ok")
    return (
      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Funcionando
      </Badge>
    );
  if (state === "erro")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" aria-hidden="true" /> Com erro
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 border-dashed text-muted-foreground">
      <CircleDashed className="h-3 w-3" aria-hidden="true" /> Sem execução
    </Badge>
  );
}

type RunResult = { runs: number; items_in: number; items_new: number; finishedReason: string };

export function IntegrationsTab() {
  const { data, isLoading, error } = useIntegrations();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const cancelRef = useRef(false);

  const handleCollectNow = async () => {
    setRunning(true);
    setRunResult(null);
    cancelRef.current = false;
    const startedAt = new Date().toISOString();
    try {
      const { error: invokeError } = await supabase.functions.invoke("fetch-news", { body: {} });
      if (invokeError) throw invokeError;
      toast({ title: "Coleta iniciada", description: "Acompanhando a rodada em segundo plano…" });

      // A função responde 202 e roda em segundo plano: acompanhamos pelas linhas reais de integration_calls.
      const deadline = Date.now() + 10 * 60_000;
      let lastSeenCount = 0;
      let lastChangeAt = Date.now();
      let reason = "tempo limite de acompanhamento atingido";
      while (Date.now() < deadline && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 8000));
        const { data: rows } = await supabase
          .from("integration_calls")
          .select("endpoint, items_in, items_new")
          .eq("integration", "ingestao")
          .gt("called_at", startedAt);
        const list = rows ?? [];
        if (list.length !== lastSeenCount) {
          lastSeenCount = list.length;
          lastChangeAt = Date.now();
          void queryClient.invalidateQueries({ queryKey: ["admin"] });
        }
        const hasGeneral = list.some((r) => r.endpoint === "geral");
        const quietTooLong = lastSeenCount > 0 && Date.now() - lastChangeAt > 60_000;
        if (hasGeneral || quietTooLong) {
          reason = hasGeneral ? "rodada concluída" : "sem novos registros há 1 min";
          setRunResult({
            runs: list.length,
            items_in: list.reduce((a, r) => a + (r.items_in ?? 0), 0),
            items_new: list.reduce((a, r) => a + (r.items_new ?? 0), 0),
            finishedReason: reason,
          });
          break;
        }
      }
      if (!runResult && lastSeenCount === 0) {
        setRunResult({ runs: 0, items_in: 0, items_new: 0, finishedReason: reason });
      }
    } catch (e) {
      logger.error("[Admin] Erro ao coletar agora", e);
      toast({ title: "Erro ao iniciar coleta", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setRunning(false);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando…" />;
  if (error || !data) return <p className="text-sm text-destructive">Não foi possível carregar o histórico de integrações.</p>;

  const byName = new Map(data.summary.map((s) => [s.integration, s]));
  const names = Array.from(new Set([...KNOWN, ...data.summary.map((s) => s.integration)]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Estado real de cada integração externa, derivado do registro de chamadas. Nada aqui é estimado.
        </p>
        <Button size="sm" onClick={handleCollectNow} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
          {running ? "Coletando…" : "Coletar agora"}
        </Button>
      </div>

      {runResult && (
        <Alert>
          <AlertTitle>Resultado da coleta ({runResult.finishedReason})</AlertTitle>
          <AlertDescription>
            {runResult.runs === 0
              ? "Nenhuma rodada de ingestão foi registrada dentro do tempo de acompanhamento. Verifique a tabela abaixo mais tarde."
              : `${runResult.runs} rodada(s) por tema · ${runResult.items_in} recebidos · ${runResult.items_new} novos.`}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {names.map((name) => {
          const meta = INTEGRATION_META[name] ?? { label: name, role: "Integração registrada pelo coletor." };
          const s = byName.get(name);
          const state: State = !s ? "nunca" : s.last_ok ? "ok" : "erro";
          return (
            <Card key={name} className={cn("border-border/60 bg-card/70", state === "erro" && "border-destructive/50")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium">{meta.label}</CardTitle>
                  <StateBadge state={state} />
                </div>
                <p className="text-xs text-muted-foreground">{meta.role}</p>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-xs">
                {!s ? (
                  <p className="text-muted-foreground">Nunca executou. Nenhuma chamada registrada.</p>
                ) : (
                  <>
                    <p><span className="text-muted-foreground">Chamadas:</span> <span className="font-medium">{s.total_calls}</span></p>
                    <p>
                      <span className="text-muted-foreground">Última:</span> {formatDateTime(s.last_called_at)}{" "}
                      {s.last_http_status !== null ? <Badge variant={s.last_ok ? "outline" : "destructive"} className="ml-1">HTTP {s.last_http_status}</Badge> : <span className="text-muted-foreground">(sem status HTTP)</span>}
                    </p>
                    <p><span className="text-muted-foreground">Duração média:</span> {formatDuration(s.avg_duration_ms)}</p>
                    {(name === "ingestao" || s.total_items_in > 0) && (
                      <p><span className="text-muted-foreground">Recebidos / novos:</span> {s.total_items_in} / {s.total_items_new}</p>
                    )}
                    {!s.last_ok && s.last_error && <p className="text-destructive" title={s.last_error}>Erro: {s.last_error.slice(0, 120)}</p>}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Últimas {data.calls.length} execuções</h3>
        <div className="overflow-x-auto rounded-md border border-border/60 bg-card/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Integração</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Recebidos</TableHead>
                <TableHead className="text-right">Novos</TableHead>
                <TableHead className="text-right">Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.calls.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">Nenhuma execução registrada até o momento.</TableCell></TableRow>
              ) : (
                data.calls.map((c) => {
                  const zeroValue = c.ok && (c.items_in ?? 0) > 0 && (c.items_new ?? 0) === 0 && c.items_new !== null;
                  return (
                    <TableRow key={c.id} className={cn("text-xs", !c.ok && "bg-destructive/5")}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(c.called_at)}</TableCell>
                      <TableCell>{INTEGRATION_META[c.integration]?.label ?? c.integration}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={c.endpoint}>{c.endpoint}</TableCell>
                      <TableCell>{c.method}</TableCell>
                      <TableCell>
                        <span title={c.error ?? undefined} className={cn("inline-flex items-center gap-1", c.ok ? "text-success" : "text-destructive")}>
                          {c.ok ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <XCircle className="h-3 w-3" aria-hidden="true" />}
                          {c.http_status ?? (c.ok ? "ok" : "falha")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.items_in ?? "—"}</TableCell>
                      <TableCell className={cn("text-right tabular-nums font-medium", zeroValue && "text-warning")} title={zeroValue ? "Respondeu, mas não trouxe nada novo" : undefined}>
                        {c.items_new ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(c.duration_ms)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
