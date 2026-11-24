import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { getGroqModel, hasGroqKey } from '@/lib/providers/groq';
import { loadProfileContext } from '@/lib/cv/profile-context';
import { currentScholarshipYears } from '@/lib/utils';
import { isExpiredOpportunity } from '@/lib/verification/rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const DEMO_LABEL = 'DEMO DATA - Connect API keys for live results';
const stopWords = new Set(['what','which','where','when','how','with','from','that','this','your','have','should','learn','find','help','review','against','jobs','match','eligible','available','nigeria','for','the','and','are','who','can','could','become','missing']);
type CacheRow = Record<string, unknown>;

function keyTerms(value: string) { return [...new Set(value.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [])].filter((word) => !stopWords.has(word)).slice(0, 12); }
function rank(rows: CacheRow[], query: string) {
  const terms = keyTerms(query);
  return rows.map((row) => {
    const text = JSON.stringify(row).toLowerCase();
    return { row, score: terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0) };
  }).sort((a, b) => b.score - a.score).filter((item) => item.score > 0).slice(0, 5).map((item) => item.row);
}
function topSkills(value: unknown): string[] {
  const collected: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === 'string' && item.trim()) collected.push(item.trim());
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  };
  visit(value);
  return [...new Set(collected)].slice(0, 5);
}
function cleanHistory(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(-12).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (!['user', 'assistant'].includes(String(role)) || typeof content !== 'string') return [];
    return [{ role: role as 'user' | 'assistant', content: content.slice(0, 2000) }];
  });
}

export async function POST(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  const history = cleanHistory(body?.history);
  if (!message) return NextResponse.json({ error: 'Enter a message.' }, { status: 400 });
  try {
    const context = await loadProfileContext(supabase, user.id);
    if (!context.profile?.career_interest || !context.profile?.career_goal) {
      const answer = 'Before I can give personalized career guidance, please complete My Career with your career interest and goal, then save your profile. I will use that context to tailor the next answer.';
      return new Response(answer, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    const [scholarshipRes, jobsRes, learningRes, savedRes, appRes, cvRes, conversationRes] = await Promise.all([
      supabase.from('scholarships_cache').select('id,title,organization,description,eligibility,application_url,official_source_url,funding_category,close_date,career_tracks,location_eligible').eq('verification_status', 'verified').contains('location_eligible', ['Nigeria']).order('last_verified_at', { ascending: false }).limit(50),
      supabase.from('jobs_cache').select('id,title,company,description,requirements,location,application_url,official_source_url,close_date').eq('verification_status', 'verified').order('last_verified_at', { ascending: false }).limit(50),
      supabase.from('learning_resources_cache').select('id,title,provider,url,official_source_url,category,is_free,skills,close_date,created_at').eq('verification_status', 'verified').limit(50),
      supabase.from('saved_items').select('item_type,item_id,notes,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('application_tracker').select('role_or_title,company_or_org,status,next_action,notes,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('generated_cvs').select('template,ats_score,readiness_score,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('assistant_conversations').select('messages,context_snapshot').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    ]);
    const contextResults: Record<string, { error: unknown }> = {
      scholarships_cache: scholarshipRes,
      jobs_cache: jobsRes,
      learning_resources_cache: learningRes,
      saved_items: savedRes,
      application_tracker: appRes,
      generated_cvs: cvRes,
      assistant_conversations: conversationRes,
    };
    const failedContext = Object.entries(contextResults).find(([, result]) => result.error);
    if (failedContext) {
      console.error(`Assistant context query failed for ${failedContext[0]}:`, failedContext[1].error);
      return NextResponse.json({ error: 'Career assistant context is unavailable. Check the server schema and retry.' }, { status: 503 });
    }
    const queryText = `${message} ${context.profile.career_interest}`;
    const savedSnapshot = conversationRes.data?.[0]?.context_snapshot;
    const recentSearches = savedSnapshot && typeof savedSnapshot === 'object' && !Array.isArray(savedSnapshot) && 'recent_searches' in savedSnapshot && Array.isArray((savedSnapshot as Record<string, unknown>).recent_searches)
      ? (savedSnapshot as Record<string, unknown>).recent_searches as unknown[]
      : [];
    const careerTerms = keyTerms(context.profile.career_interest || '');
    const eligibleScholarshipRows = (scholarshipRes.data || []).filter((row: CacheRow) => {
      const tracks = Array.isArray(row.career_tracks) ? row.career_tracks.map(String) : [];
      const indexed = tracks.length ? tracks.join(' ').toLowerCase() : JSON.stringify(row).toLowerCase();
      return careerTerms.length > 0 && careerTerms.some((term) => indexed.includes(term)) && !isExpiredOpportunity({ close_date: String(row.close_date || ''), created_at: String(row.created_at || ''), title: String(row.title || ''), description: String(row.description || '') });
    });
    const scholarships = rank(eligibleScholarshipRows, queryText);
    const activeJobs = (jobsRes.data || []).filter((row: CacheRow) => !isExpiredOpportunity({ close_date: String(row.close_date || ''), created_at: String(row.created_at || ''), title: String(row.title || ''), description: String(row.description || '') }));
    const activeLearning = (learningRes.data || []).filter((row: CacheRow) => !isExpiredOpportunity({ close_date: String(row.close_date || ''), created_at: String(row.created_at || ''), title: String(row.title || ''), description: String(row.description || '') }));
    const jobs = rank(activeJobs, queryText);
    const learning = rank(activeLearning, queryText);
    const sources = [
      ...scholarships.map((row) => ({ id: row.id, item_type: 'scholarship', title: row.title, url: row.official_source_url || row.application_url })),
      ...jobs.map((row) => ({ id: row.id, item_type: 'job', title: row.title, url: row.official_source_url || row.application_url })),
      ...learning.map((row) => ({ id: row.id, item_type: 'learning', title: row.title, url: row.official_source_url || row.url })),
    ].filter((source) => typeof source.id === 'string' && typeof source.url === 'string').slice(0, 6);
    const years = currentScholarshipYears();
    const rag = { verified_scholarships: scholarships, verified_jobs: jobs, verified_learning: learning, saved_items: savedRes.data || [], application_history: appRes.data || [], generated_cvs: cvRes.data || [], recent_searches: recentSearches, recent_conversation: conversationRes.data?.[0]?.messages || [], recent_user_questions: history.filter((item) => item.role === 'user').slice(-5) };
    const skills = topSkills(context.professional_profile?.skills);
    const gaps = context.latest_assessment?.skill_gaps || [];
    const system = `You are Isoprise's AI Career Assistant for a Nigerian user. Use only the career profile and verified RAG records provided; cite a source title and URL when discussing an opportunity. Scholarship eligibility must be based on verified scholarships, Nigeria location eligibility, and the supplied career profile; state when the data is insufficient. Do not invent employers, qualifications, deadlines, eligibility rules, application links or opportunity records. If profile context is incomplete, ask the user to complete it rather than giving generic advice. Give concrete, practical next actions. For job readiness, clarify it is an estimated skills match, not hiring success. Current year: ${years.CURRENT_YEAR}; next year: ${years.NEXT_YEAR}. Candidate profile/context: ${JSON.stringify(context).slice(0, 14000)}. Top skills: ${JSON.stringify(skills).slice(0, 3000)}. Assessment skill gaps: ${JSON.stringify(gaps)}. Verified RAG and recent context: ${JSON.stringify(rag).slice(0, 16000)}`;

    let conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
    if (conversationId) {
      const { data: existing, error } = await supabase.from('assistant_conversations').select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
      if (error || !existing) return NextResponse.json({ error: 'Conversation not found for this account.' }, { status: 404 });
    } else {
      const { data: created, error } = await supabase.from('assistant_conversations').insert({ user_id: user.id, title: message.slice(0, 100), messages: history, context_snapshot: { career_interest: context.profile.career_interest, career_level: context.profile.career_level, recent_searches: recentSearches } }).select('id').single();
      if (error || !created) return NextResponse.json({ error: 'Assistant conversation could not be saved.' }, { status: 503 });
      conversationId = created.id;
    }

    const safeSources = encodeURIComponent(JSON.stringify(sources));
    if (!hasGroqKey()) {
      const answer = `${DEMO_LABEL}\n\nI can use your saved career context, but live AI responses require Groq to be configured. Your verified opportunity sources remain available in Learning & Growth and Career Opportunities.`;
      const savedMessages = [...history, { role: 'user', content: message }, { role: 'assistant', content: answer }];
      await supabase.from('assistant_conversations').update({ messages: savedMessages, context_snapshot: { career_interest: context.profile.career_interest, career_level: context.profile.career_level, recent_searches: recentSearches, sources } }).eq('id', conversationId).eq('user_id', user.id);
      return new Response(answer, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'x-demo-mode': 'true', 'x-sources': safeSources, 'x-conversation-id': conversationId } });
    }

    const result = streamText({
      model: getGroqModel(), system,
      messages: [...history, { role: 'user', content: message }],
      onFinish: async ({ text }) => {
        const savedMessages = [...history, { role: 'user', content: message }, { role: 'assistant', content: text }];
        await supabase.from('assistant_conversations').update({ messages: savedMessages, context_snapshot: { career_interest: context.profile.career_interest, career_level: context.profile.career_level, recent_searches: recentSearches, sources } }).eq('id', conversationId).eq('user_id', user.id);
      },
    });
    return result.toTextStreamResponse({ headers: { 'Cache-Control': 'no-store', 'x-sources': safeSources, 'x-conversation-id': conversationId } });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_SCHEMA_UNAVAILABLE') return NextResponse.json({ error: 'Assistant context needs the Supabase migration and a completed profile.' }, { status: 503 });
    return NextResponse.json({ error: 'Assistant could not load the account context.' }, { status: 500 });
  }
}
