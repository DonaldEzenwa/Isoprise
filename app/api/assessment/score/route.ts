import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const assessmentId = typeof body?.assessment_id === 'string' ? body.assessment_id : '';
  const selected = body?.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : {};
  if (!assessmentId || Object.keys(selected).length > 15) return NextResponse.json({ error: 'Invalid assessment or answers.' }, { status: 400 });
  const { data: assessment, error } = await supabase.from('assessments').select('id,user_id,career_track,questions').eq('id', assessmentId).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Assessment storage is unavailable. Confirm the schema migration.' }, { status: 503 });
  if (!assessment) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
  const questions = Array.isArray(assessment.questions) ? assessment.questions as { id: string; correct: string; topic: string }[] : [];
  if (questions.length !== 15 || questions.some((question) => typeof selected[question.id] !== 'string')) return NextResponse.json({ error: 'Answer all 15 questions before scoring.' }, { status: 400 });
  const byTopic = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  const answers = questions.map((question) => {
    const isCorrect = selected[question.id] === question.correct;
    const topic = question.topic || 'general';
    const current = byTopic.get(topic) || { correct: 0, total: 0 };
    current.total += 1; if (isCorrect) { correct += 1; current.correct += 1; }
    byTopic.set(topic, current);
    return { question_id: question.id, selected: selected[question.id], is_correct: isCorrect };
  });
  const score = Math.round((correct / questions.length) * 100);
  const topic_breakdown = Object.fromEntries([...byTopic.entries()].map(([topic, value]) => [topic, Math.round((value.correct / value.total) * 100)]));
  const skill_gaps = Object.entries(topic_breakdown).filter(([, value]) => value < 70).map(([topic]) => topic);
  const { error: updateError } = await supabase.from('assessments').update({ answers, score, topic_breakdown, skill_gaps }).eq('id', assessmentId).eq('user_id', user.id);
  if (updateError) return NextResponse.json({ error: 'Assessment score could not be saved.' }, { status: 503 });
  await supabase.from('profiles').update({ proficiency_score: score, updated_at: new Date().toISOString() }).eq('id', user.id);
  return NextResponse.json({ assessment_id: assessmentId, score, topic_breakdown, skill_gaps });
}
