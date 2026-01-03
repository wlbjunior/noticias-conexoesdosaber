import { SEO } from "@/components/SEO";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FaqPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="FAQ / Ajuda – Boletim"
        description="Perguntas frequentes sobre o Boletim, comunidade interna da plataforma Conexões do Saber, e como usar as notícias temáticas."
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">FAQ / Ajuda</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Encontre respostas rápidas sobre como navegar, buscar notícias e utilizar os recursos do Boletim, a
          comunidade interna de notícias da plataforma Conexões do Saber.
        </p>
      </header>
      <Accordion type="single" collapsible className="w-full max-w-3xl divide-y divide-border rounded-md border bg-card/60">
        <AccordionItem value="o-que-e">
          <AccordionTrigger className="px-4 text-sm font-medium">O que é o Boletim dentro do Conexões do Saber?</AccordionTrigger>
          <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
            O Boletim é a comunidade interna de notícias e atualizações da plataforma Conexões do Saber. Aqui você
            encontra conteúdos organizados em temas como Mitologia, Filosofia, Artes, Religião e Psicologia, sempre
            com foco em uso educacional e cultural.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="como-buscar">
          <AccordionTrigger className="px-4 text-sm font-medium">
            Como faço para buscar notícias específicas no Boletim?
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
            Utilize o campo de busca logo abaixo do menu principal para procurar notícias por palavras-chave. Você
            também pode filtrar por tema usando o menu &quot;Temas&quot; no topo, explorando os diferentes eixos do
            Boletim dentro da plataforma.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="newsletter">
          <AccordionTrigger className="px-4 text-sm font-medium">
            Como funciona a newsletter do Boletim?
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 text-sm text-muted-foreground">
            Na barra lateral, você pode cadastrar seu e-mail para receber atualizações periódicas com destaques de
            notícias por tema. É possível escolher receber todas as notícias ou apenas alguns assuntos específicos
            dentro do Boletim.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
