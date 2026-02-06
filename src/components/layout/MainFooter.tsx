import { Link } from "react-router-dom";
import { Twitter, Github, Mail, Building2, Settings } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { TOPICS, topicStyles } from "@/lib/news/types";
import { cn } from "@/lib/utils";

const RESOURCE_LINKS = [
  "Biblioteca",
  "Glossário",
  "Cronologia",
  "Galeria",
  "Personagens",
  "Comunidade",
  "Livros",
] as const;

const EXTERNAL_LINKS = [
  { label: "Game", href: "https://rpgia.lovable.app" },
  { label: "Notícias", href: "https://noticiastemas.lovable.app" },
  { label: "Cursos", href: "https://posgraduacoes.lovable.app/" },
] as const;

export function MainFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="mt-12 border-t border-border/50 bg-gradient-to-b from-muted/30 to-muted/60 backdrop-blur-sm" 
      role="contentinfo"
    >
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 - Brand */}
          <div className="space-y-4">
            <Link 
              to="/news" 
              className="group flex items-center gap-3 text-base font-semibold text-foreground transition-colors hover:text-primary"
            >
              <img 
                src={logo} 
                alt="Conexões do Saber" 
                className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-110" 
              />
              <span>Conexões do Saber</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
              Boletim é a comunidade interna de notícias da plataforma Conexões do Saber, para explorar conhecimento em
              humanidades, artes e ciências sociais.
            </p>
            <div className="flex items-center gap-3 text-muted-foreground">
              <a 
                href="#" 
                aria-label="Twitter" 
                className="p-2 rounded-full transition-all duration-300 hover:text-primary hover:bg-primary/10"
              >
                <Twitter className="h-5 w-5" aria-hidden="true" />
              </a>
              <a 
                href="#" 
                aria-label="GitHub" 
                className="p-2 rounded-full transition-all duration-300 hover:text-primary hover:bg-primary/10"
              >
                <Github className="h-5 w-5" aria-hidden="true" />
              </a>
              <a 
                href="#" 
                aria-label="E-mail" 
                className="p-2 rounded-full transition-all duration-300 hover:text-primary hover:bg-primary/10"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Column 2 - Topics */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Temas</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {TOPICS.map((topic) => {
                const style = topicStyles[topic];
                return (
                  <li key={topic} className="flex items-center gap-2">
                    <span aria-hidden="true">{style.icon}</span>
                    <Link
                      to={`/news/topic/${topic}`}
                      className={cn(
                        'link-underline transition-colors hover:text-foreground',
                        style.textClass
                      )}
                    >
                      {style.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Coluna 3 – Recursos */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Recursos</h2>
            <ul className="space-y-2 text-sm text-muted-foreground" role="list">
              {RESOURCE_LINKS.map((label) => (
                <li key={label}>
                  <span
                    className="inline-flex items-center gap-1 cursor-not-allowed opacity-60"
                    title="Em breve"
                    aria-label={`${label} - em breve`}
                  >
                    {label}
                    <span className="text-[10px] text-muted-foreground/70">(em breve)</span>
                  </span>
                </li>
              ))}
              {EXTERNAL_LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4 – Institucional */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Institucional</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/news/sobre" className="transition-colors hover:text-foreground">
                  Sobre o projeto
                </Link>
              </li>
              <li>
                <Link to="/news/faq" className="transition-colors hover:text-foreground">
                  FAQ / Ajuda
                </Link>
              </li>
              <li>
                <Link to="/news/politica-conteudo" className="transition-colors hover:text-foreground">
                  Política de Conteúdo
                </Link>
              </li>
              <li>
                <Link to="/news/termos" className="transition-colors hover:text-foreground">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/news/privacidade" className="transition-colors hover:text-foreground">
                  Privacidade
                </Link>
              </li>
              <li>
                <a href="https://conexoesdosaber.com.br/contato" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  Contato
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <a href="https://conexoesdosaber.com.br/contato" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                  Parcerias Institucionais
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Linha inferior */}
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {currentYear} Conexões do Saber. Todos os direitos reservados.</p>

          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto inline-flex items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background",
            )}
            aria-label="Acesso administrativo"
          >
            <Link to="/admin">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </footer>
  );
}
