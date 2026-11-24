export type ProviderState = 'live' | 'dev';
const has = (key: string) => Boolean(process.env[key]?.trim());
const runtimeEnv = (name: string) => process.env[name]?.trim();

export async function getIntegrationStatus() {
  const groq: ProviderState = has('GROQ_API_KEY') ? 'live' : 'dev';
  const tavily: ProviderState = has('TAVILY_API_KEY') ? 'live' : 'dev';
  const serpapi: ProviderState = has('SERPAPI_API_KEY') || has('SERPAPI_KEY') ? 'live' : 'dev';
  const search_live = tavily === 'live' || serpapi === 'live';
  const missing: string[] = [];
  let google_auth: ProviderState = 'dev';
  let google_auth_state: 'enabled' | 'disabled' | 'unavailable' = 'unavailable';
  let github_auth: ProviderState = 'dev';
  let github_auth_state: 'enabled' | 'disabled' | 'unavailable' = 'unavailable';
  if (groq === 'dev') missing.push('GROQ_API_KEY');
  if (!search_live) missing.push('TAVILY_API_KEY or SERPAPI_KEY');

  const urlKey = ['NEXT', 'PUBLIC', 'SUPABASE', 'URL'].join('_');
  const anonKeyName = ['NEXT', 'PUBLIC', 'SUPABASE', 'ANON', 'KEY'].join('_');
  const base = runtimeEnv(urlKey)?.replace(/\/$/, '');
  const anonKey = runtimeEnv(anonKeyName);
  const serviceKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  let supabase: ProviderState = 'dev';
  let schema_ready = false;
  let storage_ready = false;
  if (base && anonKey && serviceKey) {
    try {
      const health = await fetch(`${base}/auth/v1/health`, { headers: { apikey: anonKey }, cache: 'no-store', signal: AbortSignal.timeout(4500) });
      if (!health.ok) missing.push('Supabase Auth endpoint connectivity');
      else {
        const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' };
        const checks = await Promise.all([
          fetch(`${base}/auth/v1/settings`, { headers: { apikey: anonKey }, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/profiles?select=id&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/scholarships_cache?select=id,title,organization,description,funding_category,funding_amount,eligibility,application_url,official_source_url,authorized_portal_url,official_domain,verification_status,verification_method,verified_by,last_verified_at,open_date,close_date,location_eligible,career_tracks,budget_type,year,is_featured,created_at&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/jobs_cache?select=id,title,company,description,requirements,location,employment_type,application_url,official_source_url,authorized_portal_url,official_domain,verification_status,verification_method,verified_by,last_verified_at,close_date,created_at&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/learning_resources_cache?select=id,title,provider,category,url,official_source_url,authorized_portal_url,official_domain,verification_status,verification_method,verified_by,last_verified_at,open_date,close_date,is_free,duration,skills,year,created_at&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/verification_queue?select=id,opportunity_type,opportunity_id,current_status,official_domain,submitted_url,official_source_url,authorized_portal_url,verification_method,last_checked_at,assigned_to,notes&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/reported_opportunities?select=id,user_id,opportunity_type,opportunity_id,reason,evidence_url,report_status,created_at&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/rest/v1/admin_users?select=user_id,role,created_at&limit=0`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
          fetch(`${base}/storage/v1/bucket`, { headers, cache: 'no-store', signal: AbortSignal.timeout(4500) }),
        ]);
        const [authSettings, profiles, scholarships, jobs, learning, verificationQueue, reportedOpportunities, adminUsers, bucketResponse] = checks;
        const settings = await authSettings.json().catch(() => ({}));
        const hasGoogleSetting = Boolean(settings?.external && Object.prototype.hasOwnProperty.call(settings.external, 'google'));
        const hasGithubSetting = Boolean(settings?.external && Object.prototype.hasOwnProperty.call(settings.external, 'github'));
        google_auth_state = !authSettings.ok || !hasGoogleSetting ? 'unavailable' : settings.external.google === true ? 'enabled' : 'disabled';
        google_auth = google_auth_state === 'enabled' ? 'live' : 'dev';
        github_auth_state = !authSettings.ok || !hasGithubSetting ? 'unavailable' : settings.external.github === true ? 'enabled' : 'disabled';
        github_auth = github_auth_state === 'enabled' ? 'live' : 'dev';
        supabase = profiles.ok ? 'live' : 'dev';
        const opportunity_schema_ready = [scholarships, jobs, learning, verificationQueue, reportedOpportunities, adminUsers].every((check) => check.ok);
        schema_ready = profiles.ok && opportunity_schema_ready;
        if (!profiles.ok) missing.push('Supabase profiles table/RLS');
        if (!opportunity_schema_ready) missing.push('Supabase opportunity-verification schema migration');
        if (bucketResponse.ok) {
          const parsed = await bucketResponse.json().catch(() => []);
          const buckets = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
          const privateBucket = buckets.find((bucket: { id?: string; name?: string; public?: boolean }) => bucket.id === 'career-documents' || bucket.name === 'career-documents');
          storage_ready = Boolean(privateBucket && privateBucket.public === false);
        }
        if (!storage_ready) missing.push('Private career-documents Supabase Storage bucket');
      }
    } catch { missing.push('Supabase connectivity'); }
  } else {
    if (!base) missing.push(urlKey);
    if (!anonKey) missing.push(anonKeyName);
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (google_auth_state !== 'enabled') missing.push('Supabase Google OAuth provider configuration');
  if (github_auth_state !== 'enabled') missing.push('Supabase GitHub OAuth provider configuration');
  return {
    groq, tavily, serpapi, google_auth, google_auth_state, github_auth, github_auth_state, search: search_live ? 'live' as const : 'dev' as const,
    supabase, schema_ready, opportunity_schema_ready: schema_ready && supabase !== 'dev', storage_ready, missing_dependencies: [...new Set(missing)],
    development_mode: groq === 'dev' || !search_live || google_auth === 'dev' || github_auth === 'dev' || supabase === 'dev' || !schema_ready || !storage_ready,
    demo_label: 'DEMO DATA - Connect API keys for live results',
  } as const;
}
