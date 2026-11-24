import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';

export const dynamic = 'force-dynamic';
const intelligenceSchema = z.object({
  summary: z.string().max(2000),
  qualifications: z.array(z.object({ title: z.string(), issuer: z.string().nullable(), date: z.string().nullable(), credential_id: z.string().nullable(), source_doc: z.string() })),
  skills: z.object({ technical: z.array(z.string()), tools: z.array(z.string()), professional: z.array(z.string()) }),
  projects: z.array(z.object({ title: z.string(), description: z.string(), technologies: z.array(z.string()), achievements: z.array(z.string()), source_doc: z.string() })),
  achievements: z.array(z.object({ text: z.string(), metric: z.string().nullable(), source_doc: z.string() })),
  missing_info: z.array(z.string()),
  transferable_skills: z.array(z.object({ from: z.string(), to: z.string(), mapped_skills: z.array(z.string()), source_doc: z.string() })),
  source_documents: z.array(z.string()),
});

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.document_ids) ? [...new Set(body.document_ids.filter((id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))] as string[] : [];
  if (ids.length < 1 || ids.length > 5) return NextResponse.json({ error: 'Select between one and five uploaded documents.' }, { status: 400 });
  const { data: documents, error } = await supabase.from('documents').select('id,file_name,extracted_text,extraction_status').in('id', ids).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Document records are unavailable.' }, { status: 503 });
  if (!documents || documents.length !== ids.length) return NextResponse.json({ error: 'One or more documents are not available to this account.' }, { status: 404 });
  if (documents.some((doc) => !doc.extracted_text)) return NextResponse.json({ error: 'One or more documents have no extracted text. Retry document extraction first.' }, { status: 409 });
  const sourceText = documents.map((doc) => `SOURCE DOCUMENT: ${doc.file_name}\n${doc.extracted_text}`).join('\n\n').slice(0, 50000);
  const sourceNames = new Set(documents.map((doc) => doc.file_name));
  if (!hasGroqKey()) {
    return NextResponse.json({ profile_intelligence: { summary: 'AI extraction is unavailable until Groq is configured. No profile fields have been inferred.', qualifications: [], skills: { technical: [], tools: [], professional: [] }, projects: [], achievements: [], missing_info: ['Connect Groq to extract and organize profile evidence.'], transferable_skills: [], source_documents: documents.map((doc) => doc.file_name) }, demo: true, label: 'DEMO DATA - Connect API keys for live results' });
  }
  try {
    const result = await generateObject({
      model: getGroqModel(), schema: intelligenceSchema,
      prompt: `Extract an evidence-based professional profile from the supplied documents. Do not infer dates, credential IDs, metrics, technologies or qualifications that are not stated. Identify qualifications/certification title, issuer, dates and credential IDs; projects and technologies; quantified achievements (preserve examples like 92% accuracy or team of 5 exactly); skills; missing dates/IDs/metrics; and plausible transferable skills such as Data Analysis → Data Science with mapped skills. Every extracted item must include source_doc set to an exact provided filename. Deduplicate equivalent facts. Return no unsupported claims.\n\n${sourceText}`,
    });
    const object = result.object;
    const safeSource = (name: string) => sourceNames.has(name) ? name : documents[0].file_name;
    const profile_intelligence = {
      ...object,
      qualifications: object.qualifications.map((item) => ({ ...item, source_doc: safeSource(item.source_doc) })),
      projects: object.projects.map((item) => ({ ...item, source_doc: safeSource(item.source_doc) })),
      achievements: object.achievements.map((item) => ({ ...item, source_doc: safeSource(item.source_doc) })),
      transferable_skills: object.transferable_skills.map((item) => ({ ...item, source_doc: safeSource(item.source_doc) })),
      source_documents: documents.map((doc) => doc.file_name),
    };
    return NextResponse.json({ profile_intelligence, demo: false });
  } catch {
    return NextResponse.json({ error: 'Groq document analysis failed. No extracted profile was saved; retry after checking provider configuration.' }, { status: 502 });
  }
}
