import { SEO } from "@/components/SEO";

export default function AboutPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="Sobre o Boletim"
        description="Saiba mais sobre o Boletim, comunidade interna da plataforma Conexões do Saber dedicada a notícias temáticas."
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sobre o Boletim</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          O Boletim é a comunidade interna da plataforma Conexões do Saber, dedicada a organizar conteúdos de
          humanidades, artes e ciências sociais em trilhas temáticas claras, conectando notícias, materiais de
          estudo e recursos complementares.
        </p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Nesta área de notícias temáticas, reunimos diariamente conteúdos confiáveis sobre Mitologia, Filosofia,
          Artes, Religião e Psicologia. O objetivo é facilitar a consulta rápida e a pesquisa por assunto, apoiando
          estudantes, professores, escolas, universidades e demais instituições interessadas em cultura e educação.
        </p>
        <p>
          O layout foi pensado para ser simples, responsivo e focado na leitura, com navegação clara por temas,
          recursos adicionais e um modo escuro para maior conforto visual. Instituições que desejarem construir
          projetos conjuntos ou trilhas personalizadas podem entrar em contato pela área de Parcerias Institucionais.
        </p>
      </section>
    </div>
  );
}
