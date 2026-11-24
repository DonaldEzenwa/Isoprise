import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { loadProfileContext } from '@/lib/cv/profile-context';
import { calculateReadiness } from '@/lib/readiness/score';

export const dynamic = 'force-dynamic';
const disclaimer = 'This is an estimated skills match based on your profile vs job description, not a prediction of hiring success.';

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const jobDescription = typeof body?.job_description === 'string' ? body.job_description.trim().slice(0, 12000) : '';
  const cvId = typeof body?.cv_id === 'string' ? body.cv_id : '';
  if (!jobDescription) return NextResponse.json({ error: 'A job description is required.' }, { status: 400 });
  try {
    const context = await loadProfileContext(supabase, user.id);
    if (!context.profile) return NextResponse.json({ error: 'Complete your career profile before analyzing readiness.' }, { status: 409 });
    const result = calculateReadiness(jobDescription, context.evidence);
    if (cvId) {
      const { error } = await supabase.from('generated_cvs').update({ job_description: jobDescription, readiness_score: result.readiness_score, readiness_breakdown: result.breakdown }).eq('id', cvId).eq('user_id', user.id);
      if (error) return NextResponse.json({ error: 'CV readiness could not be saved.' }, { status: 503 });
    }
    return NextResponse.json({ ...result, ats_notes: result.breakdown.filter((item) => item.status !== 'matched').slice(0, 6).map((item) => `Check evidence for: ${item.requirement}`), disclaimer });
  } catch {
    return NextResponse.json({ error: 'Profile data is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  }
}
