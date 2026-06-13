import { Helmet } from "react-helmet-async";

const SITE_NAME = "Boletim — Conexões do Saber";
const SITE_ORIGIN = "https://boletim.conexoesdosaber.com.br";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = "Boletim — Conexões do Saber",
  description = "Boletim, comunidade interna da plataforma Conexões do Saber, reúne notícias sobre Mitologia, Filosofia, Religião, Artes e Psicologia.",
  image = "/og-image.png",
  url,
  type = "website",
}: SEOProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const canonicalUrl = url
    ? url.startsWith("http")
      ? url
      : `${SITE_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`
    : `${SITE_ORIGIN}${pathname}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />

      {/* Language */}
      <html lang="pt-BR" />
    </Helmet>
  );
}
