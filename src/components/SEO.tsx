import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = "Notícias Temáticas",
  description = "As últimas notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia. Fique atualizado com os principais acontecimentos culturais e acadêmicos.",
  image = "/og-image.png",
  url = "",
  type = "website",
}: SEOProps) {
  const fullTitle = title === "Notícias Temáticas" ? title : `${title} | Notícias Temáticas`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Notícias Temáticas" />
      <meta property="og:locale" content="pt_BR" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <link rel="canonical" href={url} />
      
      {/* Language */}
      <html lang="pt-BR" />
    </Helmet>
  );
}
