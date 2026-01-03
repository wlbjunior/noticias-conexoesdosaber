import { createContext, useContext, useState, ReactNode } from "react";

interface NewsSearchContextValue {
  query: string;
  setQuery: (value: string) => void;
}

const NewsSearchContext = createContext<NewsSearchContextValue | undefined>(undefined);

export function NewsSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  return (
    <NewsSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </NewsSearchContext.Provider>
  );
}

export function useNewsSearch() {
  const context = useContext(NewsSearchContext);
  if (!context) {
    throw new Error("useNewsSearch must be used within a NewsSearchProvider");
  }
  return context;
}
