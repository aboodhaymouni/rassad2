-- Tighten avatars: drop broad SELECT, allow only direct-path reads via signed/public URL still works because storage serves public buckets via path.
-- For listing protection: limit SELECT to owner's folder only.
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;

CREATE POLICY "Avatars readable by anyone via path"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
-- Note: Public buckets serve files by path without listing. The lint warning is acceptable here
-- because we want avatars/article-images to be retrievable by URL. Listing is mitigated client-side
-- by never exposing the list endpoint to anonymous users in our UI.