export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export type ThemeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  active: boolean;
};

export const INTEGRATION_META: Record<string, { label: string; role: string }> = {
  google_news_rss: { label: "Google Notícias (RSS)", role: "Busca por tema no feed RSS do Google Notícias." },
  rss: { label: "Feeds RSS diretos", role: "Feeds de veículos e instituições cadastrados em Fontes." },
  lovable_ai: { label: "IA editorial (Lovable AI)", role: "Valida, classifica e resume as notícias coletadas." },
  ingestao: { label: "Ingestão por tema", role: "Consolida a rodada: itens recebidos versus realmente novos." },
};
