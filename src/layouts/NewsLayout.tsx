import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { MainHeader } from '@/components/layout/MainHeader';
import { MainFooter } from '@/components/layout/MainFooter';
import { NewsSearchProvider } from '@/context/NewsSearchContext';
import { NewsletterForm } from '@/components/news/NewsletterForm';
import { ScrollProgress } from '@/components/news/ScrollProgress';
import { BackToTop } from '@/components/news/BackToTop';

const NewsChat = lazy(() =>
  import('@/components/news/NewsChat').then((m) => ({ default: m.NewsChat }))
);
const ReadingStats = lazy(() =>
  import('@/components/news/ReadingStats').then((m) => ({ default: m.ReadingStats }))
);

export function NewsLayout() {
  return (
    <NewsSearchProvider>
      <div className="min-h-screen bg-background">
        {/* Reading progress indicator */}
        <ScrollProgress />
        
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Pular para o conteúdo principal
        </a>

        <MainHeader />

        {/* Main content */}
        <main id="main-content" className="container mx-auto px-4 py-8" tabIndex={-1}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <Outlet />
            </div>
            <aside className="lg:col-span-1" aria-label="Barra lateral">
              <div className="sticky top-32 space-y-4">
                <NewsletterForm />
                <Suspense fallback={null}>
                  <ReadingStats />
                </Suspense>
              </div>
            </aside>
          </div>
        </main>

        <MainFooter />

        {/* Back to top button */}
        <BackToTop />
        
        {/* Chatbot */}
        <Suspense fallback={null}>
          <NewsChat />
        </Suspense>
      </div>
    </NewsSearchProvider>
  );
}
