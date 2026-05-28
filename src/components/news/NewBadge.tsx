import { Badge } from "@/components/ui/badge";

interface NewBadgeProps {
  publishedAt: string;
}

export function NewBadge({ publishedAt }: NewBadgeProps) {
  const published = new Date(publishedAt);
  const now = new Date();
  const hoursAgo = (now.getTime() - published.getTime()) / (1000 * 60 * 60);
  
  // Show "Novo" badge if published within last 24 hours
  if (hoursAgo > 24) return null;
  
  return (
    <Badge 
      className="absolute top-2 right-2 bg-destructive text-destructive-foreground border-0 animate-pulse z-10 shadow-md"
    >
      Novo
    </Badge>
  );
}
