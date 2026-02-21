import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown, Search as SearchIcon } from "lucide-react";
import logo from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { label: "Boletim", href: "https://boletim.conexoesdosaber.com.br" },
  { label: "Academia", href: "https://academia.conexoesdosaber.com.br" },
] as const;

export function MainHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { query, setQuery } = useNewsSearch();

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
            <span className="hidden whitespace-nowrap text-sm font-medium sm:inline-block">
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
                      <span className="mr-2" aria-hidden="true">
                        {topic === "mitologia" && "⚡"}
                        {topic === "filosofia" && "💭"}
                        {topic === "artes" && "🎨"}
                        {topic === "religiao" && "⛪"}
                        {topic === "psicologia" && "🧠"}
                      </span>
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
                  <a href={item.href}>
                    {item.label}
                  </a>
                </Button>
              ))}
            </div>
          </nav>

          {/* Ações à direita */}
          <div className="flex items-center gap-2">

            {/* Botão de busca rápido – apenas ícone, usa o mesmo estado da busca */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => {
                const next = query ? "" : query;
                setQuery(next);
              }}
              aria-label="Buscar notícias"
            >
              <SearchIcon className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* Menu mobile */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mini menu with search */}
        <div className="border-t border-border/40 bg-muted/30 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-center px-4 sm:px-6 py-3">
            <div className="flex w-full items-center justify-center gap-3">
              {/* Search field */}
              <div className="flex-1 max-w-xl">
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
