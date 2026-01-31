import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Topic, TOPICS, topicStyles } from '@/lib/news/types';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const newsletterSchema = z.object({
  email: z.string().email('Por favor, insira um e-mail válido'),
  topics: z.array(z.string()).default([]),
  allTopics: z.boolean().default(false),
});

type NewsletterFormData = z.infer<typeof newsletterSchema>;

export function NewsletterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<NewsletterFormData>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      email: '',
      topics: [],
      allTopics: true,
    },
  });

  const watchAllTopics = form.watch('allTopics');

  async function onSubmit(data: NewsletterFormData) {
    setIsSubmitting(true);
    logger.log('[NewsletterForm] Submitting', { email: data.email, topicsCount: data.topics.length });

    try {
      const selectedTopics = data.allTopics ? TOPICS : (data.topics as Topic[]);
      
      const { error } = await supabase.functions.invoke('newsletter-subscribe', {
        body: { 
          email: data.email, 
          topics: selectedTopics 
        },
      });

      if (error) {
        throw error;
      }

      logger.log('[NewsletterForm] Success');
      setIsSuccess(true);
      toast({
        title: 'Cadastro realizado!',
        description: 'Verifique seu e-mail para confirmar a inscrição.',
      });
    } catch (error) {
      logger.error('[NewsletterForm] Error', error);
      toast({
        title: 'Erro ao cadastrar',
        description: 'Ocorreu um erro ao processar sua inscrição. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <Card className="border-border/50 bg-card/70 shadow-sm backdrop-blur" role="status" aria-live="polite">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-4 w-fit p-3 rounded-full bg-green-500/10">
            <CheckCircle className="h-8 w-8 text-green-500" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-base font-semibold">Inscrição realizada!</h3>
          <p className="text-xs text-muted-foreground">
            Verifique seu e-mail para receber as novidades. Verifique também a pasta de spam.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 shadow-sm backdrop-blur overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="p-1.5 rounded-full bg-primary/10 animate-pulse-soft">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          Newsletter
        </CardTitle>
        <CardDescription className="text-xs">
          Receba as últimas notícias diretamente no seu e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">E-mail</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="seu@email.com"
                      type="email"
                      className="h-9 text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allTopics"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-xs font-normal">
                    Todas as notícias
                  </FormLabel>
                </FormItem>
              )}
            />

            {!watchAllTopics && (
              <FormField
                control={form.control}
                name="topics"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Selecione os temas</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {TOPICS.map((topic) => (
                        <FormField
                          key={topic}
                          control={form.control}
                          name="topics"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(topic)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, topic]);
                                    } else {
                                      field.onChange(current.filter((t) => t !== topic));
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className={`cursor-pointer text-xs font-normal ${topicStyles[topic].textClass}`}>
                                {topicStyles[topic].label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="h-9 w-full text-xs" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Inscrever-se"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
