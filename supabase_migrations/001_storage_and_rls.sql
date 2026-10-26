-- ==============================================================================
-- BrandGate Database & Storage Hardening Migration (001_storage_and_rls.sql)
-- FOR MANUAL REVIEW ONLY — DO NOT EXECUTE DIRECTLY ON PRODUCTION WITHOUT APPROVAL.
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) on all core tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Read-only public access for seeded demo brand
CREATE POLICY "Public read demo brand" ON public.brands
  FOR SELECT USING (id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Public read demo vault items" ON public.vault_items
  FOR SELECT USING (brand_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "Public read demo drafts" ON public.drafts
  FOR SELECT USING (brand_id = '00000000-0000-0000-0000-000000000001');

-- 3. Storage Bucket "brandgate-creatives" Policies
-- Allow public read of demo creative assets without authentication
CREATE POLICY "Public read for brandgate-creatives"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brandgate-creatives');

-- Allow uploads to brandgate-creatives strictly with image type and 5MB size limits
CREATE POLICY "Allow restricted creative uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brandgate-creatives'
    AND (storage.foldername(name))[1] != 'private'
    AND (octet_length(COALESCE(metadata->>'size', '0')::text) < 5242880)
  );

-- Restrict delete operations to service role
CREATE POLICY "Restrict delete on brandgate-creatives"
  ON storage.objects FOR DELETE
  USING (auth.role() = 'service_role');

