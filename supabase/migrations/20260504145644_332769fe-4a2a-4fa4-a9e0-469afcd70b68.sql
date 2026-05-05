-- Public bucket for article thumbnails/covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Article images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-images');

-- Only admins can write/update/delete via service role (handled by edge function with service role); also allow admins from client just in case
CREATE POLICY "Admins manage article images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'admin'));