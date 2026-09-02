import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ThemeRow } from "./admin-utils";

export type PautaStatus = "sugerida" | "aprovada" | "em_producao" | "publicada" | "descartada";

export type Pauta = {
  id: string;
  news_id: string | null;
  title: string;
  angle: string | null;
  theme_id: string | null;
  status: PautaStatus;
  assignee: string | null;
  notes: string | null;
  created_at: string;
};

const COLUMNS: { key: PautaStatus; label: string }[] = [
  { key: "sugerida", label: "Sugerida" },
  { key: "aprovada", label: "Aprovada" },
  { key: "em_producao", label: "Em produção" },
  { key: "publicada", label: "Publicada" },
  { key: "descartada", label: "Descartada" },
];

export function usePautas() {
  return useQuery({
    queryKey: ["admin", "pautas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pautas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pauta[];
    },
  });
}

export function PautasTab({ themes }: { themes: ThemeRow[] }) {
  const { data: pautas = [], isLoading } = usePautas();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<PautaStatus | null>(null);
  const [editing, setEditing] = useState<Partial<Pauta> | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const moveTo = async (id: string, status: PautaStatus) => {
    const current = pautas.find((p) => p.id === id);
    if (!current || current.status === status) return;
    queryClient.setQueryData<Pauta[]>(["admin", "pautas"], (old) => (old ?? []).map((p) => (p.id === id ? { ...p, status } : p)));
    const { error } = await supabase.from("pautas").update({ status }).eq("id", id);
    if (error) {
      logger.error("[Admin] Erro ao mover pauta", error);
      toast({ title: "Erro ao mover pauta", variant: "destructive" });
    }
    void refresh();
  };

  const handleSave = async () => {
    if (!editing?.title?.trim()) {
      toast({ title: "Informe o título da pauta", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: editing.title.trim(),
      angle: editing.angle?.trim() || null,
      theme_id: editing.theme_id || null,
      status: (editing.status ?? "sugerida") as PautaStatus,
      assignee: editing.assignee?.trim() || null,
      notes: editing.notes?.trim() || null,
      news_id: editing.news_id ?? null,
    };
    const { data: userData } = await supabase.auth.getUser();
    const { error } = editing.id
      ? await supabase.from("pautas").update(payload).eq("id", editing.id)
      : await supabase.from("pautas").insert({ ...payload, created_by: userData.user?.id ?? null });
    setSaving(false);
    if (error) {
      logger.error("[Admin] Erro ao salvar pauta", error);
      toast({ title: "Erro ao salvar pauta", variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Pauta atualizada" : "Pauta criada" });
    setEditing(null);
    void refresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("pautas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir pauta", variant: "destructive" });
      return;
    }
    setEditing(null);
    void refresh();
  };

  const themeName = (id: string | null) => themes.find((t) => t.id === id)?.name ?? "Geral";

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Arraste os cartões entre as colunas para mudar o status. {pautas.length} pauta{pautas.length === 1 ? "" : "s"} no total.</p>
        <Button size="sm" onClick={() => setEditing({ status: "sugerida" })}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Nova pauta
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = pautas.filter((p) => p.status === col.key);
          return (
            <section
              key={col.key}
              aria-label={`Coluna ${col.label}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={(e) => { e.preventDefault(); if (dragging) void moveTo(dragging, col.key); setDragging(null); setOverCol(null); }}
              className={cn("flex min-h-[240px] flex-col gap-2 rounded-md border border-border/60 bg-card/50 p-2 transition-colors", overCol === col.key && "border-primary bg-primary/5")}
            >
              <header className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h3>
                <Badge variant="outline">{items.length}</Badge>
              </header>
              {items.length === 0 && <p className="px-1 text-xs text-muted-foreground">Nenhuma pauta.</p>}
              {items.map((p) => (
                <article
                  key={p.id}
                  draggable
                  onDragStart={() => setDragging(p.id)}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => setEditing(p)}
                  className={cn("cursor-grab rounded-md border border-border/60 bg-card p-2 text-xs shadow-sm hover:shadow-md active:cursor-grabbing", dragging === p.id && "opacity-50")}
                >
                  <p className="font-medium leading-snug line-clamp-3">{p.title}</p>
                  {p.angle && <p className="mt-1 text-muted-foreground line-clamp-2">{p.angle}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">{themeName(p.theme_id)}</Badge>
                    {p.assignee && <span className="text-[10px] text-muted-foreground">· {p.assignee}</span>}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar pauta" : "Nova pauta"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1"><Label htmlFor="pauta-title">Título</Label><Input id="pauta-title" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="pauta-angle">Ângulo editorial</Label><Textarea id="pauta-angle" rows={3} value={editing.angle ?? ""} onChange={(e) => setEditing({ ...editing, angle: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tema</Label>
                  <Select value={editing.theme_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, theme_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geral</SelectItem>
                      {themes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editing.status ?? "sugerida"} onValueChange={(v) => setEditing({ ...editing, status: v as PautaStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label htmlFor="pauta-assignee">Responsável</Label><Input id="pauta-assignee" value={editing.assignee ?? ""} onChange={(e) => setEditing({ ...editing, assignee: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="pauta-notes">Notas</Label><Textarea id="pauta-notes" rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              <div className="flex items-center justify-between pt-2">
                {editing.id ? (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(editing.id!)}>
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" /> Excluir
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
