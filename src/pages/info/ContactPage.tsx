import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SEO } from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Informe seu nome" })
    .max(100, { message: "Nome deve ter no máximo 100 caracteres" }),
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail deve ter no máximo 255 caracteres" }),
  subject: z
    .string()
    .trim()
    .min(1, { message: "Informe um assunto" })
    .max(150, { message: "Assunto deve ter no máximo 150 caracteres" }),
  message: z
    .string()
    .trim()
    .min(10, { message: "Mensagem muito curta" })
    .max(1000, { message: "Mensagem deve ter no máximo 1000 caracteres" }),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactPageProps {
  mode: "contato" | "parcerias";
}

export function ContactPage({ mode }: ContactPageProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: mode === "parcerias" ? "Proposta de parceria" : "Dúvida ou comentário",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      // Futuramente: enviar para área administrativa (backend)
      console.log("[ContactForm] Nova mensagem", { mode, data });
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi registrada e será encaminhada para a área administrativa.",
      });
      form.reset();
    } catch (error) {
      console.error("[ContactForm] Erro ao enviar mensagem", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível registrar sua mensagem. Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPartnership = mode === "parcerias";

  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title={isPartnership ? "Parcerias Institucionais" : "Contato"}
        description={
          isPartnership
            ? "Envie propostas de parceria institucional com o Boletim, comunidade interna da plataforma Conexões do Saber."
            : "Entre em contato com a equipe do Boletim dentro da plataforma Conexões do Saber."
        }
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {isPartnership ? "Parcerias Institucionais" : "Contato"}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {isPartnership
            ? "Use o formulário abaixo para propor parcerias acadêmicas, com escolas, universidades, grupos de pesquisa ou outras instituições interessadas em desenvolver projetos junto ao Boletim."
            : "Use o formulário abaixo para enviar dúvidas, sugestões ou relatar problemas no Boletim, comunidade interna da plataforma Conexões do Saber."}
        </p>
      </header>
      <section className="max-w-xl rounded-md border border-border bg-card/70 p-4 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-sm">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Nome</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-9 text-sm" autoComplete="name" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="h-9 text-sm" autoComplete="email" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Assunto</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-9 text-sm" />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      className="resize-none text-sm"
                      placeholder={
                        isPartnership
                          ? "Descreva a instituição, objetivos da parceria e formas de colaboração."
                          : "Descreva sua dúvida, sugestão ou relato com o máximo de detalhes relevantes."
                      }
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <Button type="submit" className="h-9 px-6 text-xs" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </form>
        </Form>
      </section>
    </div>
  );
}
