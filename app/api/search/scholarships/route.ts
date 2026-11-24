import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { searchWeb } from '@/lib/providers/search';
import { currentScholarshipYears } from '@/lib/utils';
import { recordRecentSearch } from '@/lib/assistant/search-history';
import { isExpiredOpportunity } from '@/lib/verification/rules';

export const dynamic = 'force-dynamic';

const categoryLabels: Record<string, string> = {
  fully_funded_scholarship: 'fully funded scholarships',
  partial_scholarship: 'partial scholarships',
  free_digital_skills: 'free digital skills programmes',
  technology_fellowship: 'technology fellowships',
  graduate_development: 'graduate development programmes',
  international_exchange: 'international exchange programmes',
  research_grant: 'research grants and research fellowships',
  entrepreneurship_programme: 'entrepreneurship programmes',
  innovation_challenge: 'innovation challenges and competitions',
  technology_accelerator: 'technology accelerator programmes',
};

function makeQuery(q: string, category: string, years: { CURRENT_YEAR: number; NEXT_YEAR: number }) {
  const { CURRENT_YEAR, NEXT_YEAR } = years;
  if (q) return `${q} technology ${CURRENT_YEAR} Nigeria`;
  switch (category) {
    case 'fully_funded_scholarship': return `Fully funded scholarship for Nigerians ${CURRENT_YEAR}/${NEXT_YEAR}`;
    case 'free_digital_skills': return `Free digital skills programme Nigeria ${CURRENT_YEAR}`;
    case 'technology_fellowship': return `Technology fellowship Africa ${CURRENT_YEAR} eligible Nigeria`;
    case 'graduate_development': return `Graduate trainee programme Nigeria ${CURRENT_YEAR}`;
    case 'international_exchange': return `International exchange programme Nigerian youth ${CURRENT_YEAR}`;
    case 'research_grant': return `Research grant Nigeria technology ${CURRENT_YEAR}`;
    case 'entrepreneurship_programme': return `Entrepreneurship programme Nigeria ${NEXT_YEAR}`;
    case 'innovation_challenge': return `Innovation challenge Nigeria ${CURRENT_YEAR} prize`;
    case 'technology_accelerator': return `Tech accelerator Africa ${CURRENT_YEAR} apply`;
    default: return `${categoryLabels[category] || 'technology scholarships'} technology ${CURRENT_YEAR} Nigeria`;
  }
}

function matchesSearch(row: Record<string, unknown>, query: string) {
  if (!query) return true;
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  const haystack = Object.values(row).map((value) => Array.isArray(value) ? value.join(' ') : String(value || '')).join(' ').toLowerCase();
  return terms.length === 0 || terms.every((term) => haystack.includes(term));
}

export async function GET(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 160);
  const category = url.searchParams.get('category') || '';
  const budget = url.searchParams.get('budget') || '';
  const verification = url.searchParams.get('verification_status') || '';
  const years = currentScholarshipYears();
  const requestedYear = url.searchParams.has('year') ? Number(url.searchParams.get('year')) : years.CURRENT_YEAR;
  if (![years.CURRENT_YEAR, years.NEXT_YEAR].includes(requestedYear)) return NextResponse.json({ error: 'Year must be the current or next calendar year.' }, { status: 400 });
  if (category && !categoryLabels[category]) return NextResponse.json({ error: 'Unknown funding category.' }, { status: 400 });
  if (budget && !['free', 'fully_funded', 'partial', 'paid'].includes(budget)) return NextResponse.json({ error: 'Unknown budget filter.' }, { status: 400 });
  if (verification && !['verified', 'pending', 'expired'].includes(verification)) return NextResponse.json({ error: 'Unknown verification status.' }, { status: 400 });

  let query = supabase.from('scholarships_cache').select('*').eq('year', requestedYear).limit(50);
  if (category) query = query.eq('funding_category', category);
  if (budget) query = query.eq('budget_type', budget);
  let learningQuery = supabase.from('learning_resources_cache').select('*').eq('year', requestedYear).limit(50);
  if (category) learningQuery = learningQuery.eq('category', category);
  const [scholarshipResult, learningResult] = await Promise.all([query, learningQuery]);
  if (scholarshipResult.error || learningResult.error) return NextResponse.json({ error: 'Scholarship or learning cache is unavailable. Apply the Supabase schema migration.' }, { status: 503 });
  const expireIfNeeded = (item: Record<string, unknown>) => isExpiredOpportunity({ close_date: String(item.close_date || ''), created_at: String(item.created_at || ''), title: String(item.title || ''), description: String(item.description || '') }) ? { ...item, verification_status: 'expired' } : item;
  const scholarships = (scholarshipResult.data || []).map(expireIfNeeded).filter((item: Record<string, unknown>) => matchesSearch(item, q));
  const learning = (learningResult.data || []).map(expireIfNeeded).filter((item: Record<string, unknown>) => matchesSearch(item, q) && (!budget || budget === 'free' && item.is_free === true));
  const discover = !verification || verification === 'pending';
  let live: Record<string, unknown>[] = [];
  let liveConfigured = Boolean(process.env.TAVILY_API_KEY || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY);
  if (discover) {
    const queryYears = requestedYear === years.NEXT_YEAR ? { CURRENT_YEAR: requestedYear, NEXT_YEAR: requestedYear + 1 } : years;
    const result = await searchWeb(makeQuery(q, category, queryYears));
    liveConfigured = result.configured;
    live = result.results.map((hit) => ({ id: crypto.randomUUID(), title: hit.title, organization: new URL(hit.url).hostname.replace(/^www\./, ''), description: hit.content, funding_category: category || null, application_url: null, source_url: hit.url, official_source_url: null, official_domain: null, verification_status: 'pending', verification_method: null, open_date: null, close_date: null, budget_type: null, year: requestedYear, discovery_source: 'live search (not verified)' }));
  }
  let results = [...scholarships, ...learning, ...live];
  if (verification) results = results.filter((item) => item.verification_status === verification);
  const statusRank: Record<string, number> = { verified: 0, pending: 1, expired: 2 };
  results.sort((a, b) => (statusRank[String(a.verification_status)] ?? 1) - (statusRank[String(b.verification_status)] ?? 1));
  await recordRecentSearch(supabase, user.id, { query: q || categoryLabels[category] || '', kind: 'scholarships_and_learning', category, verification_status: verification, year: requestedYear });
  return NextResponse.json({ results, year: requestedYear, next_year: years.NEXT_YEAR, provider_configured: liveConfigured, demo: false, cache_only: !liveConfigured && discover }, { headers: { 'Cache-Control': 'no-store' } });
}
