
-- Add pdf_url to notas_fiscais
ALTER TABLE public.notas_fiscais ADD COLUMN IF NOT EXISTS pdf_url text;

-- Storage bucket for NF PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('nfs', 'nfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: users access only files under their own user_id/ prefix
DROP POLICY IF EXISTS "nfs read own" ON storage.objects;
DROP POLICY IF EXISTS "nfs insert own" ON storage.objects;
DROP POLICY IF EXISTS "nfs update own" ON storage.objects;
DROP POLICY IF EXISTS "nfs delete own" ON storage.objects;

CREATE POLICY "nfs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nfs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nfs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'nfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "nfs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nfs' AND auth.uid()::text = (storage.foldername(name))[1]);
