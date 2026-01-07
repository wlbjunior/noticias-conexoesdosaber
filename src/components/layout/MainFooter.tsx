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
    <footer className="mt-12 border-t border-border bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/30" role="contentinfo">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1 – Marca */}
          <div className="space-y-4">
            <Link to="/news" className="flex items-center gap-3 text-base font-semibold text-foreground">
              <img src={logo} alt="Conexões do Saber" className="h-10 w-10 object-contain" />
              <span>Conexões do Saber</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Boletim é a comunidade interna de notícias da plataforma Conexões do Saber, para explorar conhecimento em
              humanidades, artes e ciências sociais.
            </p>
            <div className="flex items-center gap-3 text-muted-foreground">
              <a href="#" aria-label="Twitter" className="transition-colors hover:text-primary">
                <Twitter className="h-5 w-5" aria-hidden="true" />
              </a>
              <a href="#" aria-label="GitHub" className="transition-colors hover:text-primary">
                <Github className="h-5 w-5" aria-hidden="true" />
              </a>
              <a href="#" aria-label="E-mail" className="transition-colors hover:text-primary">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Coluna 2 – Temas */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Temas</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {TOPICS.map((topic) => {
                const style = topicStyles[topic];
                const emoji =
                  topic === "mitologia"
                    ? "⚡"
                    : topic === "filosofia"
                      ? "💭"
                      : topic === "artes"
                        ? "🎨"
                        : topic === "religiao"
                          ? "⛪"
                          : "🧠";
                return (
                  <li key={topic} className="flex items-center gap-2">
                    <span aria-hidden="true">{emoji}</span>
                    <Link
                      to={`/news/topic/${topic}`}
                      className="transition-colors hover:text-foreground"
                      style={{ color: style.color }}
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
            <ul className="space-y-2 text-sm text-muted-foreground">
              {RESOURCE_LINKS.map((label) => (
                <li key={label}>
                  <button
                    type="button"
                    className="w-full text-left transition-colors hover:text-foreground"
                  >
                    {label}
                  </button>
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
                <Link to="/news/contato" className="transition-colors hover:text-foreground">
                  Contato
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <Link to="/news/parcerias" className="transition-colors hover:text-foreground">
                  Parcerias Institucionais
                </Link>
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
