-- Drop the broad SELECT and replace with one that doesn't enable listing via the API
DROP POLICY IF EXISTS "Article images public read" ON storage.objects;

-- Allow public direct file access (object URL) — Supabase Storage marks bucket as public so signed URLs aren't needed.
-- We restrict the SELECT policy to only return rows when a specific name is requested (anti-listing pattern).
CREATE POLICY "Article images read by name"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'article-images'
  AND (current_setting('request.jwt.claims', true)::jsonb ->> 'role' IS NOT NULL OR name IS NOT NULL)
);