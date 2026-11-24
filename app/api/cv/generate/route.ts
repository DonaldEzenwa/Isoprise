import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';
import { loadProfileContext } from '@/lib/cv/profile-context';
import { buildDocx, buildPdf, type CVContent } from '@/lib/cv/build';
import { calculateReadiness, parseRequirements } from '@/lib/readiness/score';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const summarySchema = z.object({ summary: z.string().max(700) });

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => typeof item === 'string' ? [item] : item && typeof item === 'object' ? Object.values(item as Record<string, unknown>).filter((v): v is string => typeof v === 'string') : []).slice(0, 30);
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => Array.isArray(item) ? item.filter((v): v is string => typeof v === 'string').map((v) => `${key}: ${v}`) : typeof item === 'string' ? [`${key}: ${item}`] : []).slice(0, 30);
  return [];
}
type Row = Record<string, unknown>;
const asRow = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown): string | undefined => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const format = body?.format === 'pdf' ? 'pdf' : 'docx';
  const jobDescription = typeof body?.job_description === 'string' ? body.job_description.trim().slice(0, 12000) : '';
  const requestedProfileId = typeof body?.professional_profile_id === 'string' ? body.professional_profile_id : '';
  try {
    const context = await loadProfileContext(supabase, user.id);
    if (!context.profile) return NextResponse.json({ error: 'Save your career profile before generating a CV.' }, { status: 409 });
    if (requestedProfileId && context.professional_profile?.id !== requestedProfileId) return NextResponse.json({ error: 'Professional profile not found for this account.' }, { status: 404 });
    const pp = context.professional_profile || {};
    const qualifications = Array.isArray(pp.qualifications) ? pp.qualifications : [];
    const proSkills = list(pp.skills);
    const experiences = context.experiences.map((value: unknown) => { const item = asRow(value); return { role: text(item.role) || '', company: text(item.company), start_date: text(item.start_date), end_date: item.is_current === true ? 'Present' : text(item.end_date), description: text(item.description), achievements: list(item.achievements) }; });
    const projects = context.projects.map((value: unknown) => { const item = asRow(value); return { title: text(item.title) || 'Project', description: text(item.description), technologies: list(item.technologies), achievements: list(item.achievements) }; });
    const certificates = context.certificates.map((value: unknown) => { const item = asRow(value); return { title: text(item.title) || 'Certificate', issuing_org: text(item.issuing_org), issue_date: text(item.issue_date), credential_id: text(item.credential_id) }; });
    const skills = [...new Set([...proSkills, ...context.certificates.flatMap((value: unknown) => list(asRow(value).skills)), ...projects.flatMap((item: { technologies: string[] }) => item.technologies)])].slice(0, 24);
    if (!qualifications.length && !skills.length && !projects.length && !experiences.length && !certificates.length) return NextResponse.json({ error: 'Add at least one real qualification, skill, project, certificate or experience record before generating a CV.' }, { status: 409 });
    const evidence = JSON.stringify({ context, skills, projects, experiences, certificates }).slice(0, 45000);
    if (!evidence || evidence.length < 30) return NextResponse.json({ error: 'Add evidence from your profile, projects or experience before generating a CV.' }, { status: 409 });
    let summary = typeof pp.summary === 'string' ? pp.summary : '';
    if (hasGroqKey()) {
      try {
        const generated = await generateObject({ model: getGroqModel(), schema: summarySchema, prompt: `Write a concise ATS-compatible professional summary (max 3 sentences) for the candidate, using only facts in this profile evidence. Do not invent employers, dates, qualifications, metrics or skills. Target role: ${context.profile.career_interest || 'not provided'}. Job description: ${jobDescription || 'not provided'}. Profile evidence JSON: ${evidence}` });
        summary = generated.object.summary;
      } catch { return NextResponse.json({ error: 'Groq CV generation failed. Check provider/model configuration and retry.' }, { status: 502 }); }
    }
    if (!summary) summary = [context.profile.career_interest && `Early-career professional focused on ${context.profile.career_interest}.`, context.profile.career_goal].filter(Boolean).join(' ');
    const requirements = jobDescription ? parseRequirements(jobDescription) : [];
    const readiness = jobDescription ? calculateReadiness(jobDescription, evidence) : null;
    const relevant = requirements.filter((requirement) => readiness?.breakdown.some((row) => row.requirement === requirement && row.status !== 'gap'));
    const content: CVContent = {
      full_name: context.profile.full_name || 'Professional Profile',
      contact: [context.profile.location || 'Nigeria'].filter(Boolean),
      summary,
      experience: experiences,
      education: qualifications.map((value: unknown) => { const item = asRow(value); return { title: text(item.title) || text(item.qualification) || 'Qualification', issuer: text(item.issuer) || text(item.organization), date: text(item.date) || text(item.year), credential_id: text(item.credential_id) }; }),
      skills,
      projects,
      certificates,
      relevant_keywords: relevant,
    };
    if (![content.summary, ...content.skills, ...content.experience.map((item) => item.role), ...content.education.map((item) => item.title)].some(Boolean)) return NextResponse.json({ error: 'Your profile does not yet contain evidence to build a CV.' }, { status: 409 });
    const { data: saved, error: saveError } = await supabase.from('generated_cvs').insert({ user_id: user.id, professional_profile_id: pp.id || null, template: 'ats_clean', content, ats_score: readiness?.readiness_score ?? null, job_description: jobDescription || null, readiness_score: readiness?.readiness_score ?? null, readiness_breakdown: readiness?.breakdown ?? null }).select('id').single();
    if (saveError || !saved) return NextResponse.json({ error: 'Generated CV could not be saved. Confirm the Supabase migration.' }, { status: 503 });
    const bytes = format === 'pdf' ? await buildPdf(content) : await buildDocx(content);
    const headers = new Headers({ 'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="isoprise-cv.${format}"`, 'Cache-Control': 'private, no-store', 'x-cv-id': saved.id });
    return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_SCHEMA_UNAVAILABLE') return NextResponse.json({ error: 'CV services require the Supabase migration and profile data.' }, { status: 503 });
    return NextResponse.json({ error: 'CV generation could not be completed.' }, { status: 500 });
  }
}
