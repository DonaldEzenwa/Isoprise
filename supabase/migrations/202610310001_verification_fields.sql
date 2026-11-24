-- Add official-source verification evidence and report state to existing projects.
-- Safe to rerun; existing opportunity records and legacy report statuses are preserved.
BEGIN;

DO $$
BEGIN
  CREATE TYPE public.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.jobs_cache
  ADD COLUMN IF NOT EXISTS official_source_url TEXT,
  ADD COLUMN IF NOT EXISTS authorized_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS official_domain TEXT,
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_date DATE;

ALTER TABLE public.learning_resources_cache
  ADD COLUMN IF NOT EXISTS official_source_url TEXT,
  ADD COLUMN IF NOT EXISTS authorized_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS official_domain TEXT,
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_date DATE,
  ADD COLUMN IF NOT EXISTS close_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reported_opportunities' AND column_name = 'report_status'
  ) THEN
    ALTER TABLE public.reported_opportunities
      ADD COLUMN report_status public.report_status NOT NULL DEFAULT 'open';

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reported_opportunities' AND column_name = 'status'
    ) THEN
      UPDATE public.reported_opportunities
      SET report_status = CASE lower(status::text)
        WHEN 'reviewing' THEN 'reviewing'::public.report_status
        WHEN 'resolved' THEN 'resolved'::public.report_status
        WHEN 'dismissed' THEN 'dismissed'::public.report_status
        ELSE 'open'::public.report_status
      END;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_official_domain ON public.jobs_cache(official_domain);
CREATE INDEX IF NOT EXISTS idx_learning_resources_official_domain ON public.learning_resources_cache(official_domain);
CREATE INDEX IF NOT EXISTS idx_reported_opportunities_report_status ON public.reported_opportunities(report_status);

COMMIT;
