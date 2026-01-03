import { Outlet } from 'react-router-dom';
import { NewsChat } from '@/components/news/NewsChat';
import { MainHeader } from '@/components/layout/MainHeader';
import { MainFooter } from '@/components/layout/MainFooter';
import { NewsSearchProvider } from '@/context/NewsSearchContext';
import { NewsletterForm } from '@/components/news/NewsletterForm';
import { ReadingStats } from '@/components/news/ReadingStats';

export function NewsLayout() {
  return (
    <NewsSearchProvider>
      <div className="min-h-screen bg-background">
        {/* Skip to main content link for acessibilidade */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Pular para o conteúdo principal
        </a>

        <MainHeader />

        {/* Conteúdo principal */}
        <main id="main-content" className="container mx-auto px-4 py-8" tabIndex={-1}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <Outlet />
            </div>
            <aside className="lg:col-span-1" aria-label="Barra lateral">
              <div className="sticky top-32 space-y-4">
                <NewsletterForm />
                <ReadingStats />
              </div>
            </aside>
          </div>
        </main>

        <MainFooter />

        {/* Chatbot */}
        <NewsChat />
      </div>
    </NewsSearchProvider>
  );
}
