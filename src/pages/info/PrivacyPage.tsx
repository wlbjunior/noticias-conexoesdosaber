import { SEO } from "@/components/SEO";

export default function PrivacyPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="Privacidade no Boletim"
        description="Informações sobre como tratamos dados de navegação e inscrições na newsletter do Boletim dentro da plataforma Conexões do Saber."
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacidade</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Valorizamos sua privacidade e buscamos coletar apenas os dados estritamente necessários para o
          funcionamento do Boletim, comunidade interna da plataforma Conexões do Saber.
        </p>
      </header>
      <section className="space-y-3 text-sm leading-relaxed text-muted-foreground max-w-3xl">
        <p>
          Dados de navegação podem ser utilizados de forma agregada para melhorar a experiência de uso, como
          estatísticas de cliques por tema. Informações pessoais, como e-mail, são utilizadas apenas para os serviços
          em que você optou se inscrever, como a newsletter do Boletim.
        </p>
        <p>
          Você pode solicitar a remoção de seus dados de contato a qualquer momento por meio do formulário de contato
          disponível na seção &quot;Contato&quot; ou na área de Parcerias Institucionais, caso represente uma instituição.
        </p>
      </section>
    </div>
  );
}
