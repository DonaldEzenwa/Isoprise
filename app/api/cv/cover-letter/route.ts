import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';

export const dynamic = 'force-dynamic';
const demoLabel = 'DEMO DATA - Connect API keys for live results';

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const cvId = typeof body?.cv_id === 'string' ? body.cv_id : '';
  const jobDescription = typeof body?.job_description === 'string' ? body.job_description.trim().slice(0, 12000) : '';
  if (!cvId || !jobDescription) return NextResponse.json({ error: 'A saved CV and job description are required.' }, { status: 400 });
  const { data: cv, error } = await supabase.from('generated_cvs').select('id,content').eq('id', cvId).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'CV storage is unavailable.' }, { status: 503 });
  if (!cv) return NextResponse.json({ error: 'CV not found for this account.' }, { status: 404 });
  const { data: profile } = await supabase.from('profiles').select('full_name,career_interest,career_goal').eq('id', user.id).maybeSingle();
  let content = '';
  let demo = false;
  if (hasGroqKey()) {
    try {
      const result = await generateText({ model: getGroqModel(), prompt: `Write a concise, specific cover letter for this job. Use only facts present in the candidate CV JSON and profile; never invent achievements, employers, dates or credentials. Connect actual evidence to the role requirements. Leave no unsupported claims. Candidate profile: ${JSON.stringify(profile || {})}. CV: ${JSON.stringify(cv.content).slice(0, 20000)}. Job description: ${jobDescription}` });
      content = result.text.trim();
    } catch { return NextResponse.json({ error: 'Groq cover-letter generation failed. Check provider/model configuration and retry.' }, { status: 502 }); }
  } else {
    demo = true;
    content = `Dear Hiring Team,\n\nI am interested in the opportunity described. My saved profile identifies ${profile?.career_interest || 'a developing career direction'} as my focus. Please review the attached CV for evidence relevant to the role.\n\nI would welcome the opportunity to discuss how my documented experience and learning align with your requirements.\n\nSincerely,\n${profile?.full_name || 'Candidate'}\n\n${demoLabel}`;
  }
  const { data: saved, error: saveError } = await supabase.from('cover_letters').insert({ user_id: user.id, cv_id: cvId, content, job_description: jobDescription }).select('id').single();
  if (saveError || !saved) return NextResponse.json({ error: 'Cover letter could not be saved.' }, { status: 503 });
  return NextResponse.json({ cover_letter_id: saved.id, content, demo, ...(demo ? { label: demoLabel } : {}) });
}
