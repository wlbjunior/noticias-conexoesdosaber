import { SEO } from "@/components/SEO";

export default function ContentPolicyPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="Política de Conteúdo do Boletim"
        description="Entenda os critérios editoriais e a curadoria de conteúdo do Boletim, comunidade interna da plataforma Conexões do Saber."
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Política de Conteúdo</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Esta política descreve como selecionamos, organizamos e exibimos conteúdos no Boletim, a comunidade interna
          de notícias da plataforma Conexões do Saber.
        </p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground max-w-3xl">
        <p>
          As notícias exibidas são obtidas a partir de fontes públicas e confiáveis. Aplicamos filtros automáticos
          para reduzir conteúdos irrelevantes, de baixa qualidade ou associados a spam, priorizando materiais
          informativos e alinhados à proposta educacional do projeto.
        </p>
        <p>
          Em caso de identificação de conteúdo inadequado, desatualizado ou incorreto, este poderá ser removido ou
          ajustado. Você pode sugerir correções ou apontar problemas por meio do formulário de contato ou da área de
          Parcerias Institucionais, caso represente uma instituição interessada em colaborar com o Boletim.
        </p>
      </section>
    </div>
  );
}
