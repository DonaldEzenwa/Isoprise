import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadProfileContext(supabase: SupabaseClient, userId: string) {
  const [profileResult, professionalResult, experienceResult, certificateResult, projectResult, assessmentResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('professional_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('experiences').select('*').eq('user_id', userId).order('start_date', { ascending: false }).limit(20),
    supabase.from('certificates').select('*').eq('user_id', userId).order('issue_date', { ascending: false }).limit(30),
    supabase.from('projects').select('*').eq('user_id', userId).order('title').limit(30),
    supabase.from('assessments').select('id,career_track,score,topic_breakdown,skill_gaps,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
  ]);
  const failures = [profileResult, professionalResult, experienceResult, certificateResult, projectResult, assessmentResult].filter((result) => result.error);
  if (failures.length) throw new Error('PROFILE_SCHEMA_UNAVAILABLE');
  const context = {
    profile: profileResult.data,
    professional_profile: professionalResult.data,
    experiences: experienceResult.data || [],
    certificates: certificateResult.data || [],
    projects: projectResult.data || [],
    latest_assessment: assessmentResult.data?.[0] || null,
  };
  return { ...context, evidence: JSON.stringify(context).slice(0, 50000) };
}
