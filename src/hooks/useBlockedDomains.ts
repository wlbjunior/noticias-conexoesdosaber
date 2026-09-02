import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Lista de domínios bloqueados — mesma origem usada pelo coletor (`app_settings.blocked_domains`).
 * Evita duas listas divergentes entre front e backend.
 */
export function useBlockedDomains() {
  return useQuery({
    queryKey: ['settings', 'blocked-domains'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_blocked_domains');
      if (error) {
        logger.error('[useBlockedDomains] Error', error);
        throw error;
      }
      return (data ?? []).map((d) => d.toLowerCase());
    },
    staleTime: 1000 * 60 * 30,
    placeholderData: [],
  });
}

/** Verdadeiro quando a URL é inválida ou o host está na lista bloqueada (inclui subdomínios). */
export function isBlockedUrl(url: string, blocked: string[]): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return blocked.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}
