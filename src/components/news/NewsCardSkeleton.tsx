import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function NewsCardSkeleton() {
  return (
    <Card className="overflow-hidden border-l-4 border-muted animate-pulse">
      {/* Image skeleton with shimmer */}
      <div className="relative h-44 bg-muted overflow-hidden">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-6 w-full mt-2" />
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center gap-3 mt-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <Skeleton className="h-3 w-32" />
      </CardContent>
      
      <CardFooter className="pt-2">
        <Skeleton className="h-9 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

export function HeroNewsSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl mb-8 h-[400px] sm:h-[450px] lg:h-[500px] bg-muted animate-pulse">
      <div className="absolute inset-0 animate-shimmer" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-10">
        <div className="max-w-3xl space-y-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-12 w-48 rounded-lg mt-4" />
        </div>
      </div>
    </div>
  );
}

