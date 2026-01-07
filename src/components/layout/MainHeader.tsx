import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Menu, X, ChevronDown, Search as SearchIcon } from "lucide-react";
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

const HEADER_LINKS = [
  { label: "Biblioteca" },
  { label: "Glossário" },
  { label: "Cronologia" },
  { label: "Galeria" },
  { label: "Personagens" },
  { label: "Comunidade" },
  { label: "Livros" },
] as const;

const EXTERNAL_LINKS = [
  { label: "Game", href: "https://rpgia.lovable.app" },
  { label: "Notícias", href: "https://noticiastemas.lovable.app" },
  { label: "Cursos", href: "https://posgraduacoes.lovable.app/" },
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link
            to="/news"
            className="flex items-center gap-3 rounded-md px-1 py-1 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
              <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <span className="hidden text-sm sm:inline-block">Conexões do Saber</span>
          </Link>

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

            {/* Botões "limpos" – ainda sem rotas definidas */}
            <div className="flex items-center gap-1">
              {HEADER_LINKS.map((item) => (
                <Button
                  key={item.label}
                  type="button"
                  variant="ghost"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {/* Links externos */}
            <div className="flex items-center gap-1">
              {EXTERNAL_LINKS.map((item) => (
                <Button
                  key={item.label}
                  asChild
                  variant="ghost"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                </Button>
              ))}
            </div>
          </nav>

          {/* Ações à direita */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

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

        {/* Mini menu com busca de notícias */}
        <div className="border-t border-border/60 bg-muted/40">
          <div className="container mx-auto flex items-center justify-center px-6 py-3">
            <div className="flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Campo de busca à esquerda ocupando mais espaço */}
              <div className="flex-1 w-full">
                <NewsSearch value={query} onChange={setQuery} />
              </div>

              {/* Fato do Dia e Parcerias à direita */}
              <div className="mt-1 flex w-full items-center justify-start gap-2 sm:mt-0 sm:w-auto sm:justify-end">
                <FunFactWidget />
                <Button
                  asChild
                  size="sm"
                  className="h-9 justify-center px-4 text-xs font-medium"
                >
                  <a href="/news/parcerias">Parcerias institucionais</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
