import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { useFunFact } from "@/hooks/useFunFact";
import { Skeleton } from "@/components/ui/skeleton";

export function FunFactWidget() {
  const { data: funFact, isLoading, error } = useFunFact();

  if (error) {
    return null; // Silently fail if API is unavailable
  }

  if (isLoading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-4">
          <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </Card>
    );
  }

  if (!funFact?.fact) {
    return null;
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-all">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 text-foreground">
            💡 Fato Curioso do Dia
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {funFact.fact}
          </p>
          {funFact.category && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              Categoria: {funFact.category}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
