
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read hero-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'hero-images');

CREATE POLICY "Service role manage hero-images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'hero-images')
WITH CHECK (bucket_id = 'hero-images');
