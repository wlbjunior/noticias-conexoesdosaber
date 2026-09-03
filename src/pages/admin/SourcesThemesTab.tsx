import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit3, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { formatDateTime, ThemeRow } from "./admin-utils";

type SourceRow = {
  id: string;
  theme_id: string | null;
  kind: string;
  name: string;
  query: string | null;
  url: string | null;
  active: boolean;
  max_items: number;
  last_run_at: string | null;
  last_status: string;
  last_error: string | null;
  consecutive_failures: number;
};

type SourceDraft = Pick<SourceRow, "name" | "kind" | "theme_id" | "query" | "url" | "active" | "max_items"> & { id?: string };
type ThemeDraft = Omit<ThemeRow, "id"> & { id?: string };

const EMPTY_SOURCE: SourceDraft = { name: "", kind: "rss", theme_id: null, query: null, url: "", active: true, max_items: 20 };
const EMPTY_THEME: ThemeDraft = { name: "", slug: "", description: null, color: null, sort_order: 0, active: true };

export function useAdminThemes() {
  return useQuery({
    queryKey: ["admin", "themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("themes").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as ThemeRow[];
    },
  });
}

function useSources() {
  return useQuery({
    queryKey: ["admin", "sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sources").select("*");
      if (error) throw error;
      return (data ?? []) as SourceRow[];
    },
  });
}

export function SourcesThemesTab() {
  const { data: sources = [], isLoading: sourcesLoading, error: sourcesError } = useSources();
  const { data: themes = [], isLoading: themesLoading, error: themesError } = useAdminThemes();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [moveFromTheme, setMoveFromTheme] = useState<ThemeRow | null>(null);
  const [moveToThemeId, setMoveToThemeId] = useState("");

  const sortedSources = useMemo(() => [...sources].sort((a, b) => {
    const rank = (source: SourceRow) => source.last_status === "erro" ? 0 : source.last_status === "ok" ? 1 : 2;
    return rank(a) - rank(b) || b.consecutive_failures - a.consecutive_failures || a.name.localeCompare(b.name, "pt-BR");
  }), [sources]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });
  const themeName = (id: string | null) => themes.find((theme) => theme.id === id)?.name ?? "Geral";

  const saveSource = async () => {
    if (!sourceDraft?.name.trim() || (sourceDraft.kind === "rss" ? !sourceDraft.url?.trim() : !sourceDraft.query?.trim())) {
      toast({ title: "Preencha o nome e a origem da fonte", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: sourceDraft.name.trim(), kind: sourceDraft.kind, theme_id: sourceDraft.theme_id,
      query: sourceDraft.kind === "google_news_rss" ? sourceDraft.query?.trim() || null : null,
      url: sourceDraft.kind === "rss" ? sourceDraft.url?.trim() || null : null,
      active: sourceDraft.active, max_items: sourceDraft.max_items,
    };
    const { error } = sourceDraft.id
      ? await supabase.from("sources").update(payload).eq("id", sourceDraft.id)
      : await supabase.from("sources").insert(payload);
    setSaving(false);
    if (error) {
      logger.error("[Admin] Erro ao salvar fonte", error);
      toast({ title: "Erro ao salvar fonte", description: error.message, variant: "destructive" });
      return;
    }
    setSourceDraft(null);
    void refresh();
  };

  const toggleSource = async (source: SourceRow) => {
    const { error } = await supabase.from("sources").update({ active: !source.active }).eq("id", source.id);
    if (error) toast({ title: "Erro ao alterar a fonte", description: error.message, variant: "destructive" });
    void refresh();
  };

  const deleteSource = async (source: SourceRow) => {
    if (!window.confirm(`Excluir a fonte “${source.name}”?`)) return;
    const { error } = await supabase.from("sources").delete().eq("id", source.id);
    if (error) toast({ title: "Erro ao excluir fonte", description: error.message, variant: "destructive" });
    else void refresh();
  };

  const testSource = async (source: SourceRow) => {
    setTestingId(source.id);
    const { data, error } = await supabase.functions.invoke("fetch-news", { body: { action: "test_source", source_id: source.id } });
    setTestingId(null);
    if (error || !data?.ok) {
      toast({ title: `Teste falhou: ${source.name}`, description: data?.source?.last_error ?? error?.message ?? "Erro não informado", variant: "destructive" });
    } else {
      toast({ title: `Fonte funcionando: ${source.name}`, description: `${data.items} item(ns) recebido(s).` });
    }
    void refresh();
  };

  const saveTheme = async () => {
    if (!themeDraft?.name.trim() || !themeDraft.slug.trim()) {
      toast({ title: "Informe nome e slug do tema", variant: "destructive" });
      return;
    }
    const original = themeDraft.id ? themes.find((theme) => theme.id === themeDraft.id) : null;
    if (original && original.slug !== themeDraft.slug.trim() && !window.confirm("Alterar este slug quebrará links existentes para o tema. Deseja continuar?")) return;
    if (original?.active && !themeDraft.active) {
      const { count, error: countError } = await supabase.from("news").select("id", { count: "exact", head: true }).eq("theme_id", original.id).eq("status", "publicada");
      if (countError) {
        toast({ title: "Não foi possível conferir as notícias do tema", variant: "destructive" });
        return;
      }
      if ((count ?? 0) > 0) {
        setMoveFromTheme(original);
        setMoveToThemeId("");
        toast({ title: "Tema ainda possui notícias publicadas", description: "Escolha abaixo para qual tema movê-las antes de desativar.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const payload = { ...themeDraft, name: themeDraft.name.trim(), slug: themeDraft.slug.trim(), description: themeDraft.description?.trim() || null, color: themeDraft.color?.trim() || null };
    const { id, ...values } = payload;
    const { error } = id ? await supabase.from("themes").update(values).eq("id", id) : await supabase.from("themes").insert(values);
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar tema", description: error.message, variant: "destructive" });
    else { setThemeDraft(null); void refresh(); }
  };

  const moveAndDeactivate = async () => {
    if (!moveFromTheme || !moveToThemeId) return;
    setSaving(true);
    const { error: moveError } = await supabase.from("news").update({ theme_id: moveToThemeId }).eq("theme_id", moveFromTheme.id).eq("status", "publicada");
    const { error: themeError } = moveError ? { error: null } : await supabase.from("themes").update({ active: false }).eq("id", moveFromTheme.id);
    setSaving(false);
    const error = moveError ?? themeError;
    if (error) toast({ title: "Erro ao mover as notícias", description: error.message, variant: "destructive" });
    else { setMoveFromTheme(null); setThemeDraft(null); void refresh(); }
  };

  const deleteTheme = async (theme: ThemeRow) => {
    if (!window.confirm(`Excluir o tema “${theme.name}”? Temas vinculados a notícias ou fontes não podem ser excluídos.`)) return;
    const { error } = await supabase.from("themes").delete().eq("id", theme.id);
    if (error) toast({ title: "Tema não pode ser excluído", description: error.message, variant: "destructive" });
    else void refresh();
  };

  if (sourcesLoading || themesLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando…" />;
  if (sourcesError || themesError) return <p className="text-sm text-destructive">Não foi possível carregar fontes e temas.</p>;

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="sources-title">
        <div className="flex items-center justify-between gap-3">
          <div><h2 id="sources-title" className="text-lg font-semibold">Fontes</h2><p className="text-sm text-muted-foreground">{sources.filter((s) => s.last_status === "erro").length} em erro · {sources.filter((s) => s.last_status === "ok").length} funcionando</p></div>
          <Button size="sm" onClick={() => setSourceDraft({ ...EMPTY_SOURCE })}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Nova fonte</Button>
        </div>
        <div className="overflow-x-auto rounded-md border border-border/60">
          <Table>
            <TableHeader><TableRow><TableHead>Fonte</TableHead><TableHead>Tipo / tema</TableHead><TableHead>Busca ou URL</TableHead><TableHead>Saúde</TableHead><TableHead>Ativa</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{sortedSources.length === 0 ? <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma fonte cadastrada.</TableCell></TableRow> : sortedSources.map((source) => (
              <TableRow key={source.id} className={source.last_status === "erro" ? "bg-destructive/5 align-top" : "align-top"}>
                <TableCell className="font-medium">{source.name}</TableCell>
                <TableCell><Badge variant="outline">{source.kind}</Badge><p className="mt-1 text-xs text-muted-foreground">{themeName(source.theme_id)}</p></TableCell>
                <TableCell className="max-w-[280px] break-words text-xs">{source.kind === "rss" ? source.url : source.query}</TableCell>
                <TableCell className="min-w-[240px] text-xs"><Badge variant={source.last_status === "erro" ? "destructive" : source.last_status === "ok" ? "default" : "outline"}>{source.last_status === "erro" ? "Erro" : source.last_status === "ok" ? "Ok" : "Nunca executou"}</Badge><p className="mt-1">Última coleta: {formatDateTime(source.last_run_at)}</p><p>Falhas consecutivas: {source.consecutive_failures}</p>{source.last_error && <p className="mt-1 whitespace-normal text-destructive">{source.last_error}</p>}</TableCell>
                <TableCell><Switch checked={source.active} onCheckedChange={() => void toggleSource(source)} aria-label={`${source.active ? "Desativar" : "Ativar"} ${source.name}`} /></TableCell>
                <TableCell><div className="flex justify-end gap-1"><Button variant="outline" size="sm" disabled={testingId === source.id} onClick={() => void testSource(source)}>{testingId === source.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}Testar agora</Button><Button variant="ghost" size="icon" aria-label={`Editar ${source.name}`} onClick={() => setSourceDraft({ ...source })}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${source.name}`} onClick={() => void deleteSource(source)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="themes-title">
        <div className="flex items-center justify-between gap-3"><div><h2 id="themes-title" className="text-lg font-semibold">Temas</h2><p className="text-sm text-muted-foreground">O slug define a rota pública de cada tema.</p></div><Button size="sm" variant="outline" onClick={() => setThemeDraft({ ...EMPTY_THEME })}><Plus className="mr-2 h-4 w-4" />Novo tema</Button></div>
        <div className="overflow-x-auto rounded-md border border-border/60"><Table><TableHeader><TableRow><TableHead>Ordem</TableHead><TableHead>Nome</TableHead><TableHead>Slug</TableHead><TableHead>Descrição</TableHead><TableHead>Cor</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{themes.map((theme) => <TableRow key={theme.id}><TableCell>{theme.sort_order}</TableCell><TableCell className="font-medium">{theme.name}</TableCell><TableCell>/news/topic/{theme.slug}</TableCell><TableCell className="max-w-[300px] text-xs text-muted-foreground">{theme.description ?? "—"}</TableCell><TableCell>{theme.color ?? "—"}</TableCell><TableCell><Badge variant={theme.active ? "default" : "outline"}>{theme.active ? "Ativo" : "Inativo"}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${theme.name}`} onClick={() => setThemeDraft({ ...theme })}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${theme.name}`} onClick={() => void deleteTheme(theme)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>
      </section>

      <Dialog open={!!sourceDraft} onOpenChange={(open) => !open && setSourceDraft(null)}><DialogContent><DialogHeader><DialogTitle>{sourceDraft?.id ? "Editar fonte" : "Nova fonte"}</DialogTitle></DialogHeader>{sourceDraft && <div className="space-y-3"><div><Label htmlFor="source-name">Nome</Label><Input id="source-name" value={sourceDraft.name} onChange={(e) => setSourceDraft({ ...sourceDraft, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Tipo</Label><Select value={sourceDraft.kind} onValueChange={(kind) => setSourceDraft({ ...sourceDraft, kind })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="google_news_rss">Google Notícias RSS</SelectItem><SelectItem value="rss">RSS direto</SelectItem></SelectContent></Select></div><div><Label>Tema</Label><Select value={sourceDraft.theme_id ?? "general"} onValueChange={(value) => setSourceDraft({ ...sourceDraft, theme_id: value === "general" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="general">Geral</SelectItem>{themes.map((theme) => <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>)}</SelectContent></Select></div></div><div><Label htmlFor="source-origin">{sourceDraft.kind === "rss" ? "URL" : "Busca"}</Label><Input id="source-origin" value={(sourceDraft.kind === "rss" ? sourceDraft.url : sourceDraft.query) ?? ""} onChange={(e) => sourceDraft.kind === "rss" ? setSourceDraft({ ...sourceDraft, url: e.target.value }) : setSourceDraft({ ...sourceDraft, query: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="source-max">Máximo de itens</Label><Input id="source-max" type="number" min={1} max={100} value={sourceDraft.max_items} onChange={(e) => setSourceDraft({ ...sourceDraft, max_items: Number(e.target.value) })} /></div><div className="flex items-end gap-2 pb-2"><Switch checked={sourceDraft.active} onCheckedChange={(active) => setSourceDraft({ ...sourceDraft, active })} /><Label>Fonte ativa</Label></div></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSourceDraft(null)}>Cancelar</Button><Button onClick={() => void saveSource()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></div></div>}</DialogContent></Dialog>

      <Dialog open={!!themeDraft} onOpenChange={(open) => !open && setThemeDraft(null)}><DialogContent><DialogHeader><DialogTitle>{themeDraft?.id ? "Editar tema" : "Novo tema"}</DialogTitle></DialogHeader>{themeDraft && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="theme-name">Nome</Label><Input id="theme-name" value={themeDraft.name} onChange={(e) => setThemeDraft({ ...themeDraft, name: e.target.value })} /></div><div><Label htmlFor="theme-slug">Slug</Label><Input id="theme-slug" value={themeDraft.slug} onChange={(e) => setThemeDraft({ ...themeDraft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div></div><div><Label htmlFor="theme-description">Descrição</Label><Textarea id="theme-description" value={themeDraft.description ?? ""} onChange={(e) => setThemeDraft({ ...themeDraft, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="theme-color">Cor</Label><Input id="theme-color" value={themeDraft.color ?? ""} onChange={(e) => setThemeDraft({ ...themeDraft, color: e.target.value })} placeholder="Ex.: #1f4f7a" /></div><div><Label htmlFor="theme-order">Ordem</Label><Input id="theme-order" type="number" value={themeDraft.sort_order} onChange={(e) => setThemeDraft({ ...themeDraft, sort_order: Number(e.target.value) })} /></div></div><div className="flex items-center gap-2"><Switch checked={themeDraft.active} onCheckedChange={(active) => setThemeDraft({ ...themeDraft, active })} /><Label>Tema ativo</Label></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setThemeDraft(null)}>Cancelar</Button><Button onClick={() => void saveTheme()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></div></div>}</DialogContent></Dialog>

      <Dialog open={!!moveFromTheme} onOpenChange={(open) => !open && setMoveFromTheme(null)}><DialogContent><DialogHeader><DialogTitle>Mover notícias antes de desativar</DialogTitle></DialogHeader><Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>O tema ainda está em uso</AlertTitle><AlertDescription>As notícias publicadas de “{moveFromTheme?.name}” precisam de um novo tema.</AlertDescription></Alert><div><Label>Novo tema</Label><Select value={moveToThemeId} onValueChange={setMoveToThemeId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{themes.filter((theme) => theme.id !== moveFromTheme?.id && theme.active).map((theme) => <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>)}</SelectContent></Select></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMoveFromTheme(null)}>Cancelar</Button><Button onClick={() => void moveAndDeactivate()} disabled={!moveToThemeId || saving}>Mover e desativar</Button></div></DialogContent></Dialog>
    </div>
  );
}