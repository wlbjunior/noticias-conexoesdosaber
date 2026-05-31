/**
 * Transform a Supabase Storage public URL into a resized/compressed variant
 * served by Supabase's image rendering endpoint. Non-Supabase URLs are
 * returned untouched so external images (e.g. storage.googleapis.com) keep
 * their original delivery.
 */
export function optimizedHeroUrl(url: string | null | undefined, width = 1200): string {
  if (!url) return url ?? '';
  if (url.includes('/storage/v1/object/public/')) {
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const sep = transformed.includes('?') ? '&' : '?';
    return `${transformed}${sep}width=${width}&quality=70&resize=contain`;
  }
  return url;
}
