import { SEO } from "@/components/SEO";

export default function TermsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="Termos de Uso do Boletim"
        description="Leia os termos de uso do Boletim, comunidade interna da plataforma Conexões do Saber, e entenda as condições para utilização."
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ao utilizar o Boletim, comunidade interna da plataforma Conexões do Saber, você concorda com os termos
          abaixo. Esta é uma versão resumida e pode ser ajustada futuramente conforme a evolução do projeto.
        </p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground max-w-3xl">
        <p>
          O Boletim é oferecido para fins educacionais e informativos, sem garantias de disponibilidade contínua.
          Alterações na interface, nas fontes de dados ou nas funcionalidades podem ocorrer sem aviso prévio, sempre
          dentro do contexto da plataforma Conexões do Saber.
        </p>
        <p>
          O uso do conteúdo deve respeitar direitos autorais e políticas das fontes originais. Sempre que possível,
          fornecemos links diretos para a origem das notícias e materiais.
        </p>
      </section>
    </div>
  );
}
