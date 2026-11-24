import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';

export const dynamic = 'force-dynamic';

const mappingSchema = z.object({
  mapping: z.array(z.object({
    skill: z.string().min(1).max(120),
    status: z.enum(['transferable', 'strengthen', 'build_next']),
    evidence: z.string().nullable(),
    evidence_source: z.string().nullable(),
    next_action: z.string().max(300),
  })).max(12),
});

type Evidence = { text: string; source: string };
function addStrings(output: Evidence[], value: unknown, source: string) {
  if (typeof value === 'string' && value.trim()) output.push({ text: value.trim().slice(0, 500), source });
  else if (Array.isArray(value)) value.forEach((item) => addStrings(output, item, source));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (!['id', 'source', 'from', 'filename', 'created_at', 'updated_at'].includes(key.toLowerCase())) addStrings(output, item, source);
    });
  }
}
function evidenceSet(inputs: Array<{ value: unknown; source: string }>) {
  const output: Evidence[] = [];
  inputs.forEach(({ value, source }) => addStrings(output, value, source));
  const seen = new Set<string>();
  return output.filter((item) => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}
function ruleBasedMap(to: string, evidence: Evidence[], gaps: string[]) {
  const target = to.toLowerCase();
  const targets = target.includes('data science') || target.includes('machine learning')
    ? [
        { skill: 'SQL & data querying', patterns: /\bsql\b|query|database/i },
        { skill: 'Exploratory data analysis', patterns: /data analys|exploratory|\beda\b/i },
        { skill: 'Data visualization', patterns: /visual|tableau|power bi|dashboard/i },
        { skill: 'Statistical learning', patterns: /statistic|machine learning|\bml\b|model/i },
        { skill: 'Model deployment', patterns: /deploy|api|mlflow|production/i },
      ]
    : target.includes('software') || target.includes('developer')
      ? [
          { skill: 'Programming and scripting', patterns: /python|javascript|typescript|java|programming|coding/i },
          { skill: 'Version control', patterns: /git|version control|github/i },
          { skill: 'Testing and quality', patterns: /test|qa|quality/i },
          { skill: 'APIs and integration', patterns: /api|integration|rest|graphql/i },
        ]
      : target.includes('cyber')
        ? [
            { skill: 'Networking foundations', patterns: /network|tcp|ip|dns/i },
            { skill: 'Security analysis', patterns: /security|threat|vulnerability|incident/i },
            { skill: 'Scripting and automation', patterns: /python|bash|script|automation/i },
          ]
        : evidence.map((item) => ({ skill: item.text.slice(0, 100), patterns: new RegExp(item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }));
  return targets.slice(0, 12).map((targetSkill) => {
    const match = evidence.find((item) => targetSkill.patterns.test(item.text));
    const partial = !match && gaps.some((gap) => gap.toLowerCase().includes(targetSkill.skill.toLowerCase()) || targetSkill.skill.toLowerCase().includes(gap.toLowerCase()));
    return {
      skill: targetSkill.skill,
      status: match ? 'transferable' as const : partial ? 'strengthen' as const : 'build_next' as const,
      evidence: match?.text || null,
      evidence_source: match?.source || null,
      next_action: match ? 'Make this evidence visible in a target-role project or CV.' : partial ? 'Practise this skill and add a concrete project outcome.' : 'Build this skill through a focused learning task and a small portfolio project.',
    };
  });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const from = typeof body?.from === 'string' ? body.from.trim().slice(0, 120) : '';
  const to = typeof body?.to === 'string' ? body.to.trim().slice(0, 120) : '';
  if (!from || !to) return NextResponse.json({ error: 'Enter both the current direction and target role.' }, { status: 400 });

  const [profile, projects, experiences, certificates, assessment] = await Promise.all([
    supabase.from('professional_profiles').select('summary,qualifications,skills,transferable_skills,achievements,missing_info').eq('user_id', user.id).maybeSingle(),
    supabase.from('projects').select('title,description,technologies,achievements').eq('user_id', user.id).limit(20),
    supabase.from('experiences').select('role,company,description,achievements').eq('user_id', user.id).limit(20),
    supabase.from('certificates').select('title,issuing_org,skills').eq('user_id', user.id).limit(20),
    supabase.from('assessments').select('skill_gaps').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if ([profile, projects, experiences, certificates, assessment].some((result) => result.error)) return NextResponse.json({ error: 'Career evidence is unavailable. Apply the Supabase schema migration and try again.' }, { status: 503 });

  const inputs: Array<{ value: unknown; source: string }> = [];
  if (profile.data) {
    inputs.push({ value: profile.data.skills, source: 'Profile Intelligence skills' }, { value: profile.data.qualifications, source: 'Profile Intelligence qualifications' }, { value: profile.data.transferable_skills, source: 'Profile Intelligence transferable skills' }, { value: profile.data.achievements, source: 'Profile Intelligence achievements' }, { value: profile.data.summary, source: 'Profile Intelligence summary' });
  }
  (projects.data || []).forEach((item) => inputs.push({ value: [item.title, item.description, item.technologies, item.achievements], source: `Project: ${item.title || 'Untitled project'}` }));
  (experiences.data || []).forEach((item) => inputs.push({ value: [item.role, item.company, item.description, item.achievements], source: `Experience: ${item.role || 'Role'}` }));
  (certificates.data || []).forEach((item) => inputs.push({ value: [item.title, item.issuing_org, item.skills], source: `Certificate: ${item.title || 'Certificate'}` }));
  const evidence = evidenceSet(inputs);
  if (evidence.length === 0) return NextResponse.json({ error: 'Add projects, skills, qualifications or experience in Career Documents before creating a profile-specific transition map.', evidence_required: true }, { status: 409 });

  const gaps = Array.isArray(assessment.data?.skill_gaps) ? assessment.data.skill_gaps.map(String).slice(0, 20) : [];
  if (!hasGroqKey()) return NextResponse.json({ from, to, mapping: ruleBasedMap(to, evidence, gaps), mode: 'evidence_rules', demo: false });

  try {
    const generated = await generateObject({
      model: getGroqModel(),
      schema: mappingSchema,
      prompt: `Create a practical transition map from "${from}" to "${to}". Use only this verified profile evidence: ${JSON.stringify(evidence)}. Recent assessment gaps: ${JSON.stringify(gaps)}. Each item must be labeled transferable, strengthen, or build_next. For transferable/strengthen, evidence must be copied exactly from one supplied evidence.text value and evidence_source must match that evidence.source exactly; if no exact evidence supports the claim, return null evidence and label build_next. Do not invent credentials, experience, projects, tools, or results. Keep next_action concrete and concise. Return at most 10 items.`,
    });
    const allowed = new Map(evidence.map((item) => [item.text, item.source]));
    const mapping = generated.object.mapping.slice(0, 10).map((item) => {
      const validEvidence = item.evidence && allowed.has(item.evidence) ? item.evidence : null;
      const validSource = validEvidence ? allowed.get(validEvidence) || null : null;
      return { ...item, status: validEvidence ? item.status : 'build_next' as const, evidence: validEvidence, evidence_source: validSource };
    });
    return NextResponse.json({ from, to, mapping, mode: 'groq', demo: false });
  } catch {
    return NextResponse.json({ error: 'The transition map could not be generated. Check the Groq connection and retry.' }, { status: 502 });
  }
}
