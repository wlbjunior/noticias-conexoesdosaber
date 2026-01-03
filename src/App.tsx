import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { NewsLayout } from "./layouts/NewsLayout";
import NewsIndex from "./pages/news/NewsIndex";
import NewsByTopic from "./pages/news/NewsByTopic";
import NewsDetail from "./pages/news/NewsDetail";
import AboutPage from "./pages/info/AboutPage";
import FaqPage from "./pages/info/FaqPage";
import ContentPolicyPage from "./pages/info/ContentPolicyPage";
import TermsPage from "./pages/info/TermsPage";
import PrivacyPage from "./pages/info/PrivacyPage";
import { ContactPage } from "./pages/info/ContactPage";
import AdminPage from "./pages/admin/AdminPage";
import { NewsSearchProvider } from "@/context/NewsSearchContext";
 
const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <NewsSearchProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/news" replace />} />
              <Route path="/news" element={<NewsLayout />}>
                <Route index element={<NewsIndex />} />
                <Route path="topic/:topic" element={<NewsByTopic />} />
                <Route path=":id" element={<NewsDetail />} />
                <Route path="sobre" element={<AboutPage />} />
                <Route path="faq" element={<FaqPage />} />
                <Route path="politica-conteudo" element={<ContentPolicyPage />} />
                <Route path="termos" element={<TermsPage />} />
                <Route path="privacidade" element={<PrivacyPage />} />
                <Route path="contato" element={<ContactPage mode="contato" />} />
                <Route path="parcerias" element={<ContactPage mode="parcerias" />} />
              </Route>
              <Route path="/admin" element={<AdminPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </NewsSearchProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);
 
export default App;
