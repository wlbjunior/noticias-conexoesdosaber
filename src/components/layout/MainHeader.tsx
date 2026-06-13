import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, ChevronDown, Search as SearchIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { TOPICS, topicStyles } from "@/lib/news/types";
import { useNewsSearch } from "@/context/NewsSearchContext";
import { NewsSearch } from "@/components/news/NewsSearch";
import { FunFactWidget } from "@/components/news/FunFactWidget";

const NAV_LINKS = [
  { label: "Portal", href: "https://conexoesdosaber.com.br" },
  { label: "Acervo", href: "https://acervo.conexoesdosaber.com.br" },
  { label: "Léxico", href: "https://lexico.conexoesdosaber.com.br" },
  { label: "Cronos", href: "https://cronos.conexoesdosaber.com.br" },
  { label: "Pinacoteca", href: "https://pinacoteca.conexoesdosaber.com.br" },
  { label: "Vozes", href: "https://vozes.conexoesdosaber.com.br" },
  { label: "Ágora", href: "https://agora.conexoesdosaber.com.br" },
  { label: "Estante", href: "https://estante.conexoesdosaber.com.br" },
  { label: "Saga", href: "https://rpg.conexoesdosaber.com.br" },
  { label: "Academia", href: "https://academia.conexoesdosaber.com.br" },
] as const;

const TOPIC_EMOJI: Record<string, string> = {
  mitologia: "⚡",
  filosofia: "💭",
  artes: "🎨",
  religiao: "⛪",
  psicologia: "🧠",
};

export function MainHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { query, setQuery } = useNewsSearch();
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const currentPath = location.pathname;

  const handleSelectTopic = (topic?: string) => {
    setIsMobileMenuOpen(false);
    if (!topic) {
      navigate("/news");
      return;
    }
    navigate(`/news/topic/${topic}`);
  };

  const isActivePath = (path: string) => currentPath === path;

  const focusMobileSearch = () => {
    const input = searchWrapperRef.current?.querySelector<HTMLInputElement>('input[type="search"]');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 transition-all duration-300">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo with hover effect */}
          <a
            href="https://boletim.conexoesdosaber.com.br"
            className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-base font-semibold text-foreground transition-all duration-300 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img
              src={logo}
              alt="Conexões do Saber"
              className="h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-110"
            />
            <span className="hidden whitespace-nowrap font-serif text-base font-semibold sm:inline-block">
              Conexões do Saber
            </span>
          </a>
          <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
            {/* Dropdown Temas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground",
                    isActivePath("/news") && "text-foreground",
                  )}
                >
                  Temas
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 bg-popover/95 backdrop-blur supports-[backdrop-filter]:bg-popover/90"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">Temas principais</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => navigate("/news")}>
                  <span className="mr-2">📚</span>
                  <span className="text-sm">Geral</span>
                </DropdownMenuItem>
                {TOPICS.map((topic) => {
                  const style = topicStyles[topic];
                  return (
                    <DropdownMenuItem
                      key={topic}
                      onSelect={() => handleSelectTopic(topic)}
                    >
                      <span className="mr-2" aria-hidden="true">{TOPIC_EMOJI[topic]}</span>
                      <span className="text-sm" style={{ color: style.color }}>
                        {style.label}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Links de navegação */}
            <div className="flex items-center gap-1">
              {NAV_LINKS.map((item) => (
                <Button
                  key={item.label}
                  asChild
                  variant="ghost"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <a href={item.href}>{item.label}</a>
                </Button>
              ))}
            </div>
          </nav>

          {/* Ações à direita */}
          <div className="flex items-center gap-2">
            {/* Mobile search trigger — focuses the visible search field */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={focusMobileSearch}
              aria-label="Buscar notícias"
            >
              <SearchIcon className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* Menu mobile */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="font-serif text-left">Navegação</SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Temas
                    </h3>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => handleSelectTopic()}
                        className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span aria-hidden="true">📚</span>
                        <span>Geral</span>
                      </button>
                      {TOPICS.map((topic) => {
                        const style = topicStyles[topic];
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => handleSelectTopic(topic)}
                            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                          >
                            <span aria-hidden="true">{TOPIC_EMOJI[topic]}</span>
                            <span style={{ color: style.color }}>{style.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ecossistema
                    </h3>
                    <div className="flex flex-col">
                      {NAV_LINKS.map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </section>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mini menu with search */}
        <div className="border-t border-border/40 bg-muted/30 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-center px-4 sm:px-6 py-3">
            <div className="flex w-full items-center justify-center gap-3">
              {/* Search field */}
              <div ref={searchWrapperRef} className="flex-1 max-w-xl">
                <NewsSearch value={query} onChange={setQuery} />
              </div>

              {/* Fun Fact and Theme Toggle */}
              <div className="flex items-center gap-2">
                <FunFactWidget />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
