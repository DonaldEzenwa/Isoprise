-- Isoprise initial Supabase schema.
-- Based on the supplied schema definitions, with row-level and storage access controls hardened.
-- Run once on a Supabase project with auth and storage schemas available.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.verification_status AS ENUM ('verified', 'pending', 'expired');
CREATE TYPE public.funding_category AS ENUM (
  'fully_funded_scholarship',
  'partial_scholarship',
  'free_digital_skills',
  'technology_fellowship',
  'graduate_development',
  'international_exchange',
  'research_grant',
  'entrepreneurship_programme',
  'innovation_challenge',
  'technology_accelerator'
);
CREATE TYPE public.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  career_interest TEXT,
  career_level TEXT CHECK (career_level IN ('beginner','intermediate','advanced')),
  career_goal TEXT,
  location TEXT DEFAULT 'Nigeria',
  avatar_url TEXT,
  proficiency_score INT DEFAULT 0,
  job_readiness_avg INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ASSESSMENTS (15 Questions)
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  career_track TEXT NOT NULL,
  questions JSONB NOT NULL,
  answers JSONB,
  score INT,
  topic_breakdown JSONB,
  skill_gaps TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTS (private storage)
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending',
  source_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  issuing_org TEXT,
  issue_date DATE,
  credential_id TEXT,
  skills TEXT[],
  verified BOOLEAN DEFAULT false
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  technologies TEXT[],
  link TEXT,
  achievements TEXT[]
);

CREATE TABLE public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  company TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  achievements TEXT[]
);

-- PROFESSIONAL PROFILES (Merged Intelligence)
CREATE TABLE public.professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  merged_from_document_ids UUID[] DEFAULT '{}',
  summary TEXT,
  qualifications JSONB,
  skills JSONB,
  transferable_skills JSONB,
  missing_info TEXT[],
  achievements JSONB,
  completeness_score INT DEFAULT 0,
  last_merged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCHOLARSHIPS CACHE (publicly readable, writes reserved to trusted server/service role)
CREATE TABLE public.scholarships_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT,
  funding_category public.funding_category NOT NULL,
  funding_amount TEXT,
  eligibility TEXT,
  application_url TEXT NOT NULL,
  official_source_url TEXT,
  authorized_portal_url TEXT,
  official_domain TEXT,
  verification_status public.verification_status DEFAULT 'pending',
  verification_method TEXT,
  verified_by TEXT,
  last_verified_at TIMESTAMPTZ,
  open_date DATE,
  close_date DATE,
  location_eligible TEXT[] DEFAULT ARRAY['Nigeria'],
  career_tracks TEXT[],
  budget_type TEXT CHECK (budget_type IN ('free','fully_funded','partial','paid')),
  year INT DEFAULT EXTRACT(YEAR FROM NOW()),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.jobs_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  requirements TEXT[],
  location TEXT,
  employment_type TEXT,
  application_url TEXT,
  official_source_url TEXT,
  authorized_portal_url TEXT,
  official_domain TEXT,
  verification_status public.verification_status DEFAULT 'pending',
  verification_method TEXT,
  verified_by TEXT,
  last_verified_at TIMESTAMPTZ,
  close_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.learning_resources_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  category public.funding_category,
  url TEXT NOT NULL,
  official_source_url TEXT,
  authorized_portal_url TEXT,
  official_domain TEXT,
  verification_status public.verification_status DEFAULT 'pending',
  verification_method TEXT,
  verified_by TEXT,
  last_verified_at TIMESTAMPTZ,
  open_date DATE,
  close_date DATE,
  is_free BOOLEAN DEFAULT true,
  duration TEXT,
  skills TEXT[],
  year INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.generated_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_profile_id UUID REFERENCES public.professional_profiles(id) ON DELETE SET NULL,
  template TEXT DEFAULT 'ats_clean',
  content JSONB NOT NULL,
  ats_score INT,
  job_description TEXT,
  readiness_score INT,
  readiness_breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  cv_id UUID REFERENCES public.generated_cvs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  job_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('scholarship','job','learning','cv')),
  item_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE public.application_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type TEXT,
  item_id UUID,
  company_or_org TEXT,
  role_or_title TEXT,
  status TEXT CHECK (status IN ('saved','applied','assessment','interview','offer','rejected','withdrawn')) DEFAULT 'saved',
  applied_at DATE,
  notes TEXT,
  next_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB DEFAULT '[]',
  context_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN
CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reported_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  opportunity_type TEXT,
  opportunity_id UUID,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status public.report_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.verification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_type TEXT NOT NULL,
  opportunity_id UUID NOT NULL,
  current_status public.verification_status DEFAULT 'pending',
  official_domain TEXT,
  submitted_url TEXT,
  official_source_url TEXT,
  authorized_portal_url TEXT,
  verification_method TEXT,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  notes TEXT
);

CREATE UNIQUE INDEX verification_queue_opportunity_unique ON public.verification_queue(opportunity_type, opportunity_id);

-- Indexes for owner lookups, joins, and commonly filtered cache/admin records.
CREATE INDEX idx_assessments_user_created ON public.assessments(user_id, created_at DESC);
CREATE INDEX idx_documents_user_created ON public.documents(user_id, created_at DESC);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_document ON public.certificates(document_id);
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_experiences_user ON public.experiences(user_id);
CREATE INDEX idx_professional_profiles_user ON public.professional_profiles(user_id);
CREATE INDEX idx_scholarships_verification_close ON public.scholarships_cache(verification_status, close_date);
CREATE INDEX idx_scholarships_category ON public.scholarships_cache(funding_category);
CREATE INDEX idx_jobs_verification_close ON public.jobs_cache(verification_status, close_date);
CREATE INDEX idx_learning_resources_verification ON public.learning_resources_cache(verification_status);
CREATE INDEX idx_generated_cvs_user_created ON public.generated_cvs(user_id, created_at DESC);
CREATE INDEX idx_generated_cvs_profile ON public.generated_cvs(professional_profile_id);
CREATE INDEX idx_cover_letters_user_created ON public.cover_letters(user_id, created_at DESC);
CREATE INDEX idx_cover_letters_cv ON public.cover_letters(cv_id);
CREATE INDEX idx_saved_items_user_created ON public.saved_items(user_id, created_at DESC);
CREATE INDEX idx_application_tracker_user_status ON public.application_tracker(user_id, status);
CREATE INDEX idx_assistant_conversations_user_created ON public.assistant_conversations(user_id, created_at DESC);
CREATE INDEX idx_reported_opportunities_user_created ON public.reported_opportunities(user_id, created_at DESC);
CREATE INDEX idx_reported_opportunities_status ON public.reported_opportunities(status);
CREATE INDEX idx_verification_queue_status ON public.verification_queue(current_status);
CREATE INDEX idx_verification_queue_assigned ON public.verification_queue(assigned_to);

-- Membership check runs as the function owner, avoiding recursive RLS on admin_users.
-- Admin membership is represented by an admin_users row whose role is 'admin'.
CREATE FUNCTION public.is_verified_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users AS au
    WHERE au.user_id = auth.uid()
      AND au.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_verified_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_verified_admin() TO authenticated, service_role;

-- Enable RLS on every application table, including admin_users.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_resources_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reported_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_queue ENABLE ROW LEVEL SECURITY;

-- Authenticated users may access only rows owned by their auth.uid().
CREATE POLICY profiles_owner_all ON public.profiles
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY assessments_owner_all ON public.assessments
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY documents_owner_all ON public.documents
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY certificates_owner_all ON public.certificates
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY projects_owner_all ON public.projects
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY experiences_owner_all ON public.experiences
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY professional_profiles_owner_all ON public.professional_profiles
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY generated_cvs_owner_all ON public.generated_cvs
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY cover_letters_owner_all ON public.cover_letters
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY saved_items_owner_all ON public.saved_items
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY application_tracker_owner_all ON public.application_tracker
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY assistant_conversations_owner_all ON public.assistant_conversations
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Public cache tables are SELECT-only for client roles; ingestion belongs to trusted server/service role.
CREATE POLICY scholarships_cache_public_read ON public.scholarships_cache
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY jobs_cache_public_read ON public.jobs_cache
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY learning_resources_cache_public_read ON public.learning_resources_cache
  FOR SELECT TO anon, authenticated USING (true);

-- Reports can be created and viewed only by their owner; clients cannot change or delete them.
CREATE POLICY reported_opportunities_owner_insert ON public.reported_opportunities
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY reported_opportunities_owner_select ON public.reported_opportunities
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Admin records and verification queue require admin membership for every client operation.
CREATE POLICY admin_users_admin_all ON public.admin_users
  FOR ALL TO authenticated
  USING (public.is_verified_admin())
  WITH CHECK (public.is_verified_admin());
CREATE POLICY verification_queue_admin_all ON public.verification_queue
  FOR ALL TO authenticated
  USING (public.is_verified_admin())
  WITH CHECK (public.is_verified_admin());

-- Explicit client grants, with RLS remaining the row-level authority.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.assessments,
  public.documents,
  public.certificates,
  public.projects,
  public.experiences,
  public.professional_profiles,
  public.generated_cvs,
  public.cover_letters,
  public.saved_items,
  public.application_tracker,
  public.assistant_conversations,
  public.admin_users,
  public.verification_queue
TO authenticated;
GRANT SELECT, INSERT ON public.reported_opportunities TO authenticated;
GRANT SELECT ON public.scholarships_cache, public.jobs_cache, public.learning_resources_cache TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON
  public.scholarships_cache,
  public.jobs_cache,
  public.learning_resources_cache
FROM PUBLIC, anon, authenticated;

-- Private storage bucket; conflict handling only enforces private visibility.
INSERT INTO storage.buckets (id, name, public)
VALUES ('career-documents', 'career-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY career_documents_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'career-documents'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
CREATE POLICY career_documents_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'career-documents'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
CREATE POLICY career_documents_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'career-documents'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'career-documents'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
CREATE POLICY career_documents_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'career-documents'
    AND split_part(name, '/', 1) = (SELECT auth.uid())::text
  );
