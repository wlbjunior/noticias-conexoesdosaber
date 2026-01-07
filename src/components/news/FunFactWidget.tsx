import { Lightbulb } from "lucide-react";
import { useFunFact } from "@/hooks/useFunFact";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FunFactWidget() {
  const { data: funFact, isLoading, error } = useFunFact();

  if (error || (!isLoading && !funFact?.fact)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
        <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 cursor-help hover:bg-primary/15 transition-colors max-w-[200px] sm:max-w-[280px]">
            <Lightbulb className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              Fato do Dia
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-sm p-4 bg-popover border border-border shadow-lg"
          sideOffset={8}
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm flex items-center gap-2">
              <span>💡</span> Fato Curioso do Dia
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {funFact?.fact}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
