import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NewsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function NewsSearch({ value, onChange }: NewsSearchProps) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Buscar notícias..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        aria-label="Buscar notícias"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
