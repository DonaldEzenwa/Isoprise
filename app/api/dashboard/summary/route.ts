import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { isExpiredOpportunity } from '@/lib/verification/rules';
import { getIntegrationStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;

  const [profile, assessment, professionalProfile, cv, application, saved, reportStatus, legacyReportStatus] = await Promise.all([
    supabase.from('profiles').select('career_interest,career_goal').eq('id', user.id).maybeSingle(),
    supabase.from('assessments').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('professional_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('generated_cvs').select('id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('application_tracker').select('id').eq('user_id', user.id).limit(1).maybeSingle(),
    supabase.from('saved_items').select('item_type,item_id', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('reported_opportunities').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('report_status', 'open'),
    supabase.from('reported_opportunities').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'open'),
  ]);

  const coreResults = [profile, assessment, professionalProfile, cv, application, saved];
  const coreDataAvailable = coreResults.every((result) => !result.error);
  const reportCount = reportStatus.error ? legacyReportStatus : reportStatus;
  const openReports = reportCount.error ? null : reportCount.count ?? 0;
  const savedRows = saved.data || [];
  const savedItemsTotal = saved.count ?? (saved.error ? null : savedRows.length);
  const savedItemsComplete = savedItemsTotal !== null && savedItemsTotal <= savedRows.length;
  const steps = [
    { title: 'Career profile', href: '/career', complete: !profile.error && Boolean(profile.data?.career_interest && profile.data?.career_goal) },
    { title: 'Skills assessment', href: '/career', complete: !assessment.error && Boolean(assessment.data) },
    { title: 'Profile Intelligence', href: '/documents', complete: !professionalProfile.error && Boolean(professionalProfile.data) },
    { title: 'ATS CV', href: '/cv-studio', complete: !cv.error && Boolean(cv.data) },
    { title: 'Application tracking', href: '/applications', complete: !application.error && Boolean(application.data) },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const careerProgress = { score: Math.round(completed / steps.length * 100), completed, total: steps.length, available: coreDataAvailable, steps };
  const scholarshipIds = savedRows.filter((item) => item.item_type === 'scholarship').map((item) => item.item_id).slice(0, 100);
  const jobIds = savedRows.filter((item) => item.item_type === 'job').map((item) => item.item_id).slice(0, 100);
  const learningIds = savedRows.filter((item) => item.item_type === 'learning').map((item) => item.item_id).slice(0, 100);
  const cacheQueries = [
    scholarshipIds.length ? supabase.from('scholarships_cache').select('*').in('id', scholarshipIds) : null,
    jobIds.length ? supabase.from('jobs_cache').select('*').in('id', jobIds) : null,
    learningIds.length ? supabase.from('learning_resources_cache').select('*').in('id', learningIds) : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null);
  const [cacheResults, integrationStatus] = await Promise.all([
    Promise.all(cacheQueries),
    getIntegrationStatus(),
  ]);
  const verificationSchemaReady = integrationStatus.opportunity_schema_ready;

  if (cacheResults.some((result) => result.error)) {
    return NextResponse.json({ career_progress: careerProgress, alerts: { pending_verification: null, expired_opportunities: null, open_reports: openReports, verification_schema_ready: verificationSchemaReady, verification_counts_complete: false, saved_items_scanned: savedRows.length, saved_items_total: savedItemsTotal } }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const opportunityRows: Array<Record<string, unknown>> = [];
  cacheResults.forEach((result) => (result.data || []).forEach((item) => opportunityRows.push(item as Record<string, unknown>)));
  const pendingVerification = opportunityRows.filter((item) => item.verification_status === 'pending').length;
  const expiredOpportunities = opportunityRows.filter((item) => item.verification_status === 'expired' || isExpiredOpportunity({ close_date: String(item.close_date || ''), created_at: String(item.created_at || ''), title: String(item.title || ''), description: String(item.description || '') })).length;
  const verificationCountsComplete = verificationSchemaReady && savedItemsComplete;

  return NextResponse.json({
    career_progress: careerProgress,
    alerts: {
      pending_verification: verificationCountsComplete ? pendingVerification : null,
      expired_opportunities: verificationCountsComplete ? expiredOpportunities : null,
      open_reports: openReports,
      verification_schema_ready: verificationSchemaReady,
      verification_counts_complete: verificationCountsComplete,
      saved_items_scanned: savedRows.length,
      saved_items_total: savedItemsTotal,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
