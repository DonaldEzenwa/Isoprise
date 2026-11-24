import { NextResponse } from 'next/server';
import { getUserOrResponse } from '@/lib/supabase/auth';
import { searchWeb } from '@/lib/providers/search';
import { recordRecentSearch } from '@/lib/assistant/search-history';
import { isExpiredOpportunity } from '@/lib/verification/rules';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user, supabase, response } = await getUserOrResponse();
  if (response || !user || !supabase) return response;
  const url = new URL(request.url);
  const type = (url.searchParams.get('type') || 'any').slice(0, 20);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 160);
  const verification = url.searchParams.get('verification_status') || '';
  if (!['any', 'jobs', 'internships', 'graduate'].includes(type)) return NextResponse.json({ error: 'Unsupported opportunity type.' }, { status: 400 });
  if (verification && !['verified', 'pending', 'expired'].includes(verification)) return NextResponse.json({ error: 'Unknown verification status.' }, { status: 400 });

  const query = supabase.from('jobs_cache').select('*').limit(100);
  const { data: cached, error } = await query;
  if (error) return NextResponse.json({ error: 'Job cache is unavailable. Apply the Supabase schema migration.' }, { status: 503 });

  const searchTerms = q.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  const matchesSearch = (row: Record<string, unknown>) => !q || searchTerms.length === 0 || searchTerms.some((term) => JSON.stringify(row).toLowerCase().includes(term));
  const expireIfNeeded = (row: Record<string, unknown>) => isExpiredOpportunity({ close_date: String(row.close_date || ''), created_at: String(row.created_at || ''), title: String(row.title || ''), description: String(row.description || '') }) ? { ...row, verification_status: 'expired' } : row;
  const typeTerm = type === 'internships' ? 'intern' : type === 'graduate' ? 'graduate' : '';
  const cachedRows = (cached || []).map(expireIfNeeded).filter((row: Record<string, unknown>) => {
    const roleText = `${row.employment_type || ''} ${row.title || ''} ${row.description || ''}`.toLowerCase();
    const typeMatches = !typeTerm || (type === 'graduate' ? /graduate|trainee/.test(roleText) : roleText.includes(typeTerm));
    return matchesSearch(row) && typeMatches;
  });
  const discover = (!verification || verification === 'pending') && Boolean(q);
  const currentYear = new Date().getFullYear();
  let live: Record<string, unknown>[] = [];
  let configured = Boolean(process.env.TAVILY_API_KEY || process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY);
  if (discover) {
    const searchTerm = type === 'internships' ? `internship ${q} Nigeria ${currentYear}` : type === 'graduate' ? `graduate trainee ${q} Nigeria ${currentYear}` : `${q} jobs internships graduate programmes Nigeria ${currentYear}`;
    const result = await searchWeb(searchTerm);
    configured = result.configured;
    live = result.results.map((hit) => ({ id: crypto.randomUUID(), title: hit.title, company: new URL(hit.url).hostname.replace(/^www\./, ''), description: hit.content, requirements: [], location: 'Nigeria (check source)', employment_type: type === 'any' ? 'opportunity' : type, application_url: null, source_url: hit.url, official_source_url: null, verification_status: 'pending', last_verified_at: null, close_date: null, discovery_source: 'live search (not verified)' }));
  }
  let results = [...cachedRows, ...live];
  if (verification) results = results.filter((item) => item.verification_status === verification);
  const statusRank: Record<string, number> = { verified: 0, pending: 1, expired: 2 };
  results.sort((a, b) => (statusRank[String(a.verification_status)] ?? 1) - (statusRank[String(b.verification_status)] ?? 1));
  await recordRecentSearch(supabase, user.id, { query: q || type, kind: 'career_opportunities', category: type, verification_status: verification });
  return NextResponse.json({ results, provider_configured: configured, demo: false, cache_only: !configured && discover }, { headers: { 'Cache-Control': 'no-store' } });
}
