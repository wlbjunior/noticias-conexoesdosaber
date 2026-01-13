import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, ShieldAlert, Mail, RefreshCw, FileText, Plus, Edit3, Trash2, Send } from "lucide-react";
import { logger } from "@/lib/logger";

const adminEmail = "wlbjunior@gmail.com";

const authSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Informe um e-mail válido" }),
  password: z
    .string()
    .min(6, { message: "A senha deve ter pelo menos 6 caracteres" })
    .max(100, { message: "A senha deve ter no máximo 100 caracteres" }),
});

type AuthFormData = z.infer<typeof authSchema>;

type MessageStatus = "novo" | "em_analise" | "respondido";

type ContactMessage = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  type: "contato" | "parceria";
  subject: string | null;
  message: string;
  status: MessageStatus;
};

type NewsletterSubscription = {
  email: string;
  topics: string[];
  confirmed: boolean;
  created_at: string;
  last_sent_at: string | null;
};

type RefreshControl = {
  id: string;
  created_at: string;
  last_refresh_at: string;
};

type InternalNews = {
  id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_id: string | null;
  is_pinned: boolean;
  topic: "mitologia" | "filosofia" | "religiao" | "artes" | "psicologia";
  body: string;
  status: string;
  title: string;
};

type DiscardedNews = {
  id: string;
  topic: InternalNews["topic"];
  title: string;
  description: string | null;
  source_name: string | null;
  source_url: string;
  published_at: string;
  discarded_at: string;
  reason: string | null;
  ai_raw_answer: string | null;
  restored: boolean;
};

export default function AdminPage() {
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [newsletter, setNewsletter] = useState<NewsletterSubscription[]>([]);
  const [refreshInfo, setRefreshInfo] = useState<RefreshControl | null>(null);
  const [internalNews, setInternalNews] = useState<InternalNews[]>([]);
  const [discardedNews, setDiscardedNews] = useState<DiscardedNews[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isRunningNewsRefresh, setIsRunningNewsRefresh] = useState(false);
  const [isSendingNewsletter, setIsSendingNewsletter] = useState(false);
 
  const [statusFilter, setStatusFilter] = useState<"all" | MessageStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "contato" | "parceria">("all");
  const [internalStatusFilter, setInternalStatusFilter] = useState<"all" | string>("all");
  const [internalTopicFilter, setInternalTopicFilter] = useState<"all" | InternalNews["topic"]>("all");

  
  const [editingInternal, setEditingInternal] = useState<InternalNews | null>(null);
  const [viewingInternal, setViewingInternal] = useState<InternalNews | null>(null);
  const [deletingInternal, setDeletingInternal] = useState<InternalNews | null>(null);
  const [internalTitle, setInternalTitle] = useState("");
  const [internalBody, setInternalBody] = useState("");
  const [internalTopic, setInternalTopic] = useState<InternalNews["topic"]>("mitologia");
  const [internalStatus, setInternalStatus] = useState<string>("rascunho");
  const [internalDate, setInternalDate] = useState<Date | null>(null);
  const [internalPinned, setInternalPinned] = useState(false);

  const authForm = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
      })
      .finally(() => setAuthLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const bootstrapAdmin = async () => {
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }

      if (session.user.email !== adminEmail) {
        setIsAdmin(false);
        return;
      }

      try {
        await supabase.from("user_roles").upsert(
          { user_id: session.user.id, role: "admin" },
          { onConflict: "user_id,role" },
        );
      } catch (error) {
        logger.error("[Admin] Erro ao garantir role de admin", error);
      }

      setIsAdmin(true);
      void loadAdminData();
    };

    void bootstrapAdmin();
  }, [session]);

  const loadAdminData = async () => {
    try {
      setDataLoading(true);

      const [messagesRes, newsletterRes, refreshRes, internalNewsRes, discardedNewsRes] = await Promise.all([
        supabase
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("newsletter_subscriptions")
          .select("email, topics, confirmed, created_at, last_sent_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("news_refresh_control")
          .select("*")
          .order("last_refresh_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("internal_news")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("discarded_news")
          .select("*")
          .order("discarded_at", { ascending: false }),
      ]);

      if (messagesRes.error) throw messagesRes.error;
      if (newsletterRes.error) throw newsletterRes.error;
      if (refreshRes.error) throw refreshRes.error;
      if (internalNewsRes.error) throw internalNewsRes.error;
      if (discardedNewsRes.error) throw discardedNewsRes.error;

      setMessages((messagesRes.data || []) as ContactMessage[]);
      setNewsletter((newsletterRes.data || []) as NewsletterSubscription[]);
      setRefreshInfo((refreshRes.data as RefreshControl | null) ?? null);
      setInternalNews((internalNewsRes.data || []) as InternalNews[]);
      setDiscardedNews((discardedNewsRes.data || []) as DiscardedNews[]);
    } catch (error) {
      logger.error("[Admin] Erro ao carregar dados administrativos", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as mensagens ou estatísticas.",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (statusFilter !== "all" && msg.status !== statusFilter) return false;
      if (typeFilter !== "all" && msg.type !== typeFilter) return false;
      return true;
    });
  }, [messages, statusFilter, typeFilter]);

  const filteredInternalNews = useMemo(() => {
    return internalNews
      .filter((item) => {
        if (internalStatusFilter !== "all" && item.status !== internalStatusFilter) return false;
        if (internalTopicFilter !== "all" && item.topic !== internalTopicFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }

        const aDate = a.published_at ?? a.created_at;
        const bDate = b.published_at ?? b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [internalNews, internalStatusFilter, internalTopicFilter]);

  const handleUpdateStatus = async (id: string, status: MessageStatus) => {
    try {
      const { error } = await supabase
        .from("contact_messages")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      toast({
        title: "Status atualizado",
        description: "O status da mensagem foi atualizado com sucesso.",
      });
    } catch (error) {
      logger.error("[Admin] Erro ao atualizar status", error);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const resetInternalForm = () => {
    setEditingInternal(null);
    setInternalTitle("");
    setInternalBody("");
    setInternalTopic("mitologia");
    setInternalStatus("rascunho");
    setInternalDate(null);
    setInternalPinned(false);
  };

  const handleSaveInternalNews = async () => {
    if (!internalTitle.trim() || !internalBody.trim()) {
      toast({
        title: "Preencha título e corpo",
        description: "Título e corpo da notícia interna são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const isPublishing = internalStatus === "publicado";
    const payload: Partial<InternalNews> & {
      topic: InternalNews["topic"];
      title: string;
      body: string;
      status: string;
      published_at: string | null;
      is_pinned: boolean;
    } = {
      title: internalTitle.trim(),
      body: internalBody.trim(),
      topic: internalTopic,
      status: internalStatus,
      published_at: isPublishing
        ? (internalDate ? internalDate.toISOString() : new Date().toISOString())
        : null,
      is_pinned: internalPinned,
    };

    try {
      let error;
      let data;

      if (editingInternal) {
        const result = await supabase
          .from("internal_news")
          .update(payload)
          .eq("id", editingInternal.id)
          .select("*")
          .maybeSingle();
        error = result.error;
        data = result.data;
      } else {
        const result = await supabase
          .from("internal_news")
          .insert(payload as any)
          .select("*")
          .maybeSingle();
        error = result.error;
        data = result.data;
      }

      if (error) throw error;

      if (data) {
        setInternalNews((prev) => {
          const others = prev.filter((n) => n.id !== data.id);
          return [data as InternalNews, ...others];
        });
      }

      toast({
        title: "Notícia interna salva",
        description: editingInternal
          ? "A notícia interna foi atualizada com sucesso."
          : "A nova notícia interna foi criada com sucesso.",
      });
      resetInternalForm();
    } catch (error) {
      logger.error("[Admin] Erro ao salvar notícia interna", error);
      toast({
        title: "Erro ao salvar notícia interna",
        description: "Não foi possível salvar a notícia interna. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEditInternal = (item: InternalNews) => {
    setEditingInternal(item);
    setInternalTitle(item.title);
    setInternalBody(item.body);
    setInternalTopic(item.topic);
    setInternalStatus(item.status);
    setInternalDate(item.published_at ? new Date(item.published_at) : null);
    setInternalPinned(item.is_pinned);
  };

  const handleDeleteInternalConfirmed = async () => {
    if (!deletingInternal) return;
 
    try {
      const { error } = await supabase
        .from("internal_news")
        .delete()
        .eq("id", deletingInternal.id);
 
      if (error) throw error;
 
      setInternalNews((prev) => prev.filter((n) => n.id !== deletingInternal.id));
      setDeletingInternal(null);
 
      toast({
        title: "Notícia interna excluída",
        description: "A notícia interna foi removida com sucesso.",
      });
    } catch (error) {
      logger.error("[Admin] Erro ao excluir notícia interna", error);
      toast({
        title: "Erro ao excluir notícia interna",
        description: "Não foi possível excluir a notícia interna. Tente novamente.",
        variant: "destructive",
      });
    }
  };
 
  const handleAuthSubmit = async (data: AuthFormData) => {
    if (data.email !== adminEmail) {
      toast({
        title: "E-mail não autorizado",
        description: "Acesso restrito apenas ao responsável pelo Boletim.",
        variant: "destructive",
      });
      return;
    }
 
    try {
      setAuthLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
    } catch (error) {
      logger.error("[Admin] Erro na autenticação", error);
      toast({
        title: "Erro na autenticação",
        description: "Não foi possível acessar. Verifique seus dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAuthLoading(false);
    }
  };
 
  const handleRunNewsRefresh = async () => {
    try {
      setIsRunningNewsRefresh(true);
      const { error } = await supabase.functions.invoke("fetch-news");

      if (error) {
        throw error;
      }

      toast({
        title: "Atualização iniciada",
        description:
          "O processo de atualização de notícias foi disparado. Aguarde alguns instantes e atualize a página do Boletim.",
      });
    } catch (error) {
      logger.error("[Admin] Erro ao rodar atualização de notícias", error);
      toast({
        title: "Erro ao atualizar notícias",
        description: "Não foi possível rodar a atualização agora. Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsRunningNewsRefresh(false);
    }
  };

  const handleSendNewsletter = async () => {
    try {
      setIsSendingNewsletter(true);
      const { data, error } = await supabase.functions.invoke("send-newsletter");

      if (error) {
        throw error;
      }

      const result = (data as any) ?? {};
      toast({
        title: "Envio de newsletter disparado",
        description:
          result.sent !== undefined && result.total !== undefined
            ? `E-mails enviados: ${result.sent} de ${result.total} assinantes. Skips: ${result.skipped ?? 0}.`
            : "A função foi executada. Verifique os logs e sua caixa de entrada para confirmar os envios.",
      });
    } catch (error) {
      logger.error("[Admin] Erro ao enviar newsletter manualmente", error);
      toast({
        title: "Erro ao enviar newsletter",
        description: "Não foi possível disparar o envio agora. Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSendingNewsletter(false);
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  if (authLoading && !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center space-y-6 px-4 py-8">
        <SEO
          title="Acesso Administrativo – Boletim"
          description="Área restrita para administração do Boletim na plataforma Conexões do Saber."
        />

        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Acesso Administrativo</h1>
          <p className="text-sm text-muted-foreground">
            Esta área é restrita ao responsável pelo Boletim, comunidade interna da plataforma Conexões do Saber.
          </p>
        </header>

        <form onSubmit={authForm.handleSubmit(handleAuthSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail administrativo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...authForm.register("email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...authForm.register("password")}
            />
          </div>
          <Button type="submit" className="w-full" disabled={authLoading}>
            {authLoading ? "Entrando..." : "Entrar"}
          </Button>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" aria-hidden="true" />
            Use sempre o e-mail cadastrado para administração do Boletim.
          </p>
        </form>

        <Alert variant="default">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Acesso exclusivo</AlertTitle>
          <AlertDescription className="text-xs">
            As informações de contato, parcerias e newsletter exibidas aqui são confidenciais e destinadas apenas à
            coordenação do Boletim.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-4 py-8 lg:px-10">
      <SEO
        title="Administração do Boletim"
        description="Área administrativa do Boletim na plataforma Conexões do Saber para gestão de mensagens, newsletter e notícias internas."
      />

      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administração do Boletim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie mensagens de contato e parcerias, assinaturas do newsletter, notícias internas e acompanhe o status das
            atualizações de notícias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAdminData} disabled={dataLoading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Atualizar dados
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </header>

      <Tabs defaultValue="messages" className="space-y-6">
        <TabsList>
          <TabsTrigger value="messages">Mensagens de Contato e Parcerias</TabsTrigger>
          <TabsTrigger value="newsletter">Assinantes do Newsletter</TabsTrigger>
          <TabsTrigger value="internal-news">Notícias internas</TabsTrigger>
          <TabsTrigger value="discarded-news">Notícias descartadas pela IA</TabsTrigger>
          <TabsTrigger value="status">Status das Atualizações</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="respondido">Respondido</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="contato">Contato</SelectItem>
                  <SelectItem value="parceria">Parcerias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredMessages.length} mensagem{filteredMessages.length === 1 ? "" : "s"} encontrada
              {filteredMessages.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/60 bg-card/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma mensagem encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMessages.map((msg) => (
                    <TableRow key={msg.id} className="align-top text-xs">
                      <TableCell>
                        {new Date(msg.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{msg.type === "parceria" ? "Parceria" : "Contato"}</Badge>
                      </TableCell>
                      <TableCell>{msg.name}</TableCell>
                      <TableCell>{msg.email}</TableCell>
                      <TableCell>{msg.subject || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            msg.status === "novo"
                              ? "default"
                              : msg.status === "em_analise"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {msg.status === "novo"
                            ? "Novo"
                            : msg.status === "em_analise"
                              ? "Em análise"
                              : "Respondido"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={msg.status}
                          onValueChange={(v) => handleUpdateStatus(msg.id, v as MessageStatus)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="novo">Novo</SelectItem>
                            <SelectItem value="em_analise">Em análise</SelectItem>
                            <SelectItem value="respondido">Respondido</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="newsletter" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Lista de e-mails inscritos no newsletter do Boletim. Esses dados são confidenciais e devem ser utilizados com
              responsabilidade.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleSendNewsletter}
              disabled={isSendingNewsletter}
            >
              {isSendingNewsletter ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Enviando newsletter...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Disparar envio agora
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de assinantes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-semibold">{newsletter.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {newsletter.length === 1 ? "1 pessoa inscrita" : `${newsletter.length} pessoas inscritas`}.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Assinantes confirmados</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-semibold">
                  {newsletter.filter((sub) => sub.confirmed).length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {newsletter.length > 0
                    ? `${Math.round(
                        (newsletter.filter((sub) => sub.confirmed).length / newsletter.length) * 100,
                      )}% da base confirmou o e-mail.`
                    : "Aguardando primeiras confirmações."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Último envio de newsletter</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {(() => {
                  const lastSent = newsletter
                    .map((sub) => sub.last_sent_at)
                    .filter(Boolean)
                    .map((d) => new Date(d as string))
                    .sort((a, b) => b.getTime() - a.getTime())[0];

                  if (!lastSent) {
                    return <p className="text-sm text-muted-foreground">Nenhum envio registrado até o momento.</p>;
                  }

                  return (
                    <>
                      <p className="text-sm font-medium">
                        {lastSent.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Considerando o campo de último envio dos assinantes.</p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Crescimento recente de assinantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                {(() => {
                  if (newsletter.length === 0) {
                    return <p>Nenhuma inscrição de newsletter até o momento.</p>;
                  }

                  const byMonth = new Map<string, number>();

                  for (const sub of newsletter) {
                    const date = new Date(sub.created_at);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
                  }

                  const series = Array.from(byMonth.entries())
                    .sort(([a], [b]) => (a > b ? 1 : -1))
                    .slice(-6);

                  return (
                    <ul className="space-y-1">
                      {series.map(([month, count]) => {
                        const [year, monthNumber] = month.split("-");
                        const label = new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString("pt-BR", {
                          month: "short",
                          year: "2-digit",
                        });

                        return (
                          <li key={month} className="flex items-center justify-between">
                            <span>{label}</span>
                            <span className="font-medium text-foreground">
                              {count} nova{count === 1 ? "" : "s"} assinatura{count === 1 ? "" : "s"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Envios diários recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
                {(() => {
                  const withSends = newsletter.filter((sub) => sub.last_sent_at);

                  if (withSends.length === 0) {
                    return <p>Nenhum envio registrado na base de assinantes ainda.</p>;
                  }

                  const byDay = new Map<string, number>();

                  for (const sub of withSends) {
                    const date = new Date(sub.last_sent_at as string);
                    const key = date.toISOString().slice(0, 10);
                    byDay.set(key, (byDay.get(key) ?? 0) + 1);
                  }

                  const series = Array.from(byDay.entries())
                    .sort(([a], [b]) => (a > b ? -1 : 1))
                    .slice(0, 7);

                  return (
                    <ul className="space-y-1">
                      {series.map(([day, count]) => {
                        const label = new Date(day).toLocaleDateString("pt-BR", { dateStyle: "short" });
                        return (
                          <li key={day} className="flex items-center justify-between">
                            <span>{label}</span>
                            <span className="font-medium text-foreground">{count} envio{count === 1 ? "" : "s"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-md border border-border/60 bg-card/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Confirmado</TableHead>
                  <TableHead>Temas</TableHead>
                  <TableHead>Inscrito em</TableHead>
                  <TableHead>Último envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newsletter.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma inscrição encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  newsletter.map((sub) => (
                    <TableRow key={sub.email} className="text-xs">
                      <TableCell>{sub.email}</TableCell>
                      <TableCell>
                        <Badge variant={sub.confirmed ? "default" : "outline"}>
                          {sub.confirmed ? "Confirmado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>{sub.topics.join(", ")}</TableCell>
                      <TableCell>
                        {new Date(sub.created_at).toLocaleDateString("pt-BR", {
                          dateStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        {sub.last_sent_at
                          ? new Date(sub.last_sent_at).toLocaleDateString("pt-BR", { dateStyle: "short" })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Alert>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Status das últimas atualizações</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                {refreshInfo ? (
                  <span>
                    A última atualização automática das notícias ocorreu em{" "}
                    {new Date(refreshInfo.last_refresh_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    .
                  </span>
                ) : (
                  <span>
                    Ainda não há registro de execução do processo automático de atualização de notícias para o Boletim.
                  </span>
                )}
              </p>
              <Button
                size="sm"
                onClick={handleRunNewsRefresh}
                disabled={isRunningNewsRefresh}
                className="mt-2"
              >
                {isRunningNewsRefresh ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Rodando atualização de notícias...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Rodar atualização de notícias agora
                  </span>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="discarded-news" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Notícias que foram descartadas automaticamente pela IA por não parecerem realmente relacionadas ao tema
            escolhido. Você pode revisá-las e restaurar alguma notícia específica, se considerar apropriado.
          </p>

          <div className="overflow-x-auto rounded-md border border-border/60 bg-card/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descartada em</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discardedNews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma notícia descartada pela IA até o momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  discardedNews.map((item) => (
                    <TableRow key={item.id} className="align-top text-xs">
                      <TableCell>
                        {new Date(item.discarded_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>{item.topic}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.title}>
                        {item.title}
                      </TableCell>
                      <TableCell>{item.source_name || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.reason || undefined}>
                        {item.reason || "Marcada como irrelevante pela IA"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={item.restored ? "outline" : "default"}
                          disabled={item.restored}
                          onClick={async () => {
                            try {
                              const { error: insertError } = await supabase.from("news").insert({
                                title: item.title,
                                description: item.description,
                                source_name: item.source_name,
                                source_url: item.source_url,
                                topic: item.topic,
                                published_at: item.published_at,
                                image_url: null,
                                full_article_url: null,
                              });

                              if (insertError) throw insertError;

                              const { error: updateError } = await supabase
                                .from("discarded_news")
                                .update({ restored: true })
                                .eq("id", item.id);

                              if (updateError) throw updateError;

                              setDiscardedNews((prev) =>
                                prev.map((n) => (n.id === item.id ? { ...n, restored: true } : n)),
                              );

                              toast({
                                title: "Notícia restaurada",
                                description:
                                  "A notícia foi restaurada e voltará a aparecer na listagem principal do Boletim.",
                              });
                            } catch (error) {
                              logger.error("[Admin] Erro ao restaurar notícia descartada", error);
                              toast({
                                title: "Erro ao restaurar notícia",
                                description: "Não foi possível restaurar a notícia. Tente novamente.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          {item.restored ? "Restaurada" : "Restaurar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="internal-news" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Select
                value={internalStatusFilter}
                onValueChange={(v) => setInternalStatusFilter(v as typeof internalStatusFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={internalTopicFilter}
                onValueChange={(v) => setInternalTopicFilter(v as typeof internalTopicFilter)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tópico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tópicos</SelectItem>
                  <SelectItem value="mitologia">Mitologia</SelectItem>
                  <SelectItem value="filosofia">Filosofia</SelectItem>
                  <SelectItem value="religiao">Religião</SelectItem>
                  <SelectItem value="artes">Artes</SelectItem>
                  <SelectItem value="psicologia">Psicologia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                resetInternalForm();
                setEditingInternal({} as InternalNews);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova notícia interna
            </Button>
          </div>

          {editingInternal && (
            <div className="rounded-md border border-border/60 bg-card/70 p-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-medium">
                  {editingInternal?.id ? "Editar notícia interna" : "Nova notícia interna"}
                </h3>
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                  <Select value={internalStatus} onValueChange={(v) => setInternalStatus(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="publicado">Publicado</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={internalTopic} onValueChange={(v) => setInternalTopic(v as InternalNews["topic"])}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Tópico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mitologia">Mitologia</SelectItem>
                      <SelectItem value="filosofia">Filosofia</SelectItem>
                      <SelectItem value="religiao">Religião</SelectItem>
                      <SelectItem value="artes">Artes</SelectItem>
                      <SelectItem value="psicologia">Psicologia</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          !internalDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {internalDate ? format(internalDate, "dd/MM/yyyy") : <span>Data de publicação</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={internalDate ?? undefined}
                        onSelect={(date) => setInternalDate(date ?? null)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="flex items-center gap-2">
                    <input
                      id="internal-pinned"
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-background"
                      checked={internalPinned}
                      onChange={(e) => setInternalPinned(e.target.checked)}
                    />
                    <Label htmlFor="internal-pinned" className="text-xs">
                      Fixar no topo do Boletim
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-title">Título</Label>
                <Input
                  id="internal-title"
                  value={internalTitle}
                  onChange={(e) => setInternalTitle(e.target.value)}
                  placeholder="Título da notícia interna"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-body">Corpo da notícia</Label>
                <Textarea
                  id="internal-body"
                  value={internalBody}
                  onChange={(e) => setInternalBody(e.target.value)}
                  rows={6}
                  placeholder="Escreva aqui o texto completo da notícia interna."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={resetInternalForm}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveInternalNews}>
                  Salvar notícia
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-border/60 bg-card/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tópico</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInternalNews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma notícia interna encontrada com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInternalNews.map((item) => (
                    <TableRow key={item.id} className="align-top text-xs">
                      <TableCell>
                        {item.published_at
                          ? new Date(item.published_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : new Date(item.created_at).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                      </TableCell>
                      <TableCell>{item.topic}</TableCell>
                      <TableCell className="max-w-xs truncate" title={item.title}>
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "publicado"
                              ? "default"
                              : item.status === "rascunho"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {item.status === "publicado"
                            ? "Publicado"
                            : item.status === "rascunho"
                              ? "Rascunho"
                              : "Arquivado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Ver texto completo"
                          onClick={() => setViewingInternal(item)}
                        >
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Editar"
                          onClick={() => handleEditInternal(item)}
                        >
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive border-destructive/50"
                          aria-label="Excluir"
                          onClick={() => setDeletingInternal(item)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog open={!!viewingInternal} onOpenChange={() => setViewingInternal(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{viewingInternal?.title}</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-2 text-sm">
                {viewingInternal?.published_at && (
                  <p className="text-xs text-muted-foreground">
                    Publicado em {" "}
                    {new Date(viewingInternal.published_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{viewingInternal?.body}</p>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deletingInternal} onOpenChange={() => setDeletingInternal(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir notícia interna</AlertDialogTitle>
              </AlertDialogHeader>
              <p className="text-sm text-muted-foreground">
                Tem certeza de que deseja excluir a notícia interna
                {" "}
                <span className="font-medium">{deletingInternal?.title}</span>? Essa ação não poderá ser desfeita.
              </p>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteInternalConfirmed} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
