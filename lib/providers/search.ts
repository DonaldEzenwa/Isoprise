import { parseHttpUrl } from '@/lib/verification/rules';

export type SearchHit = { title: string; url: string; content: string; score?: number };

async function searchTavily(query: string): Promise<SearchHit[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: 'basic', max_results: 8, include_answer: false }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return (Array.isArray(data.results) ? data.results : []).map((item: Record<string, unknown>) => {
      const safe = parseHttpUrl(typeof item.url === 'string' ? item.url : '');
      return safe ? { title: String(item.title || 'Opportunity listing').slice(0, 240), url: safe.href, content: String(item.content || '').slice(0, 1600), score: typeof item.score === 'number' ? item.score : undefined } : null;
    }).filter((item: SearchHit | null): item is SearchHit => Boolean(item));
  } catch { return null; }
}

async function searchSerpApi(query: string): Promise<SearchHit[] | null> {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({ engine: 'google', q: query, api_key: apiKey, num: '8' });
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const data = await response.json();
    return (Array.isArray(data.organic_results) ? data.organic_results : []).map((item: Record<string, unknown>) => {
      const safe = parseHttpUrl(typeof item.link === 'string' ? item.link : '');
      return safe ? { title: String(item.title || 'Opportunity listing').slice(0, 240), url: safe.href, content: String(item.snippet || '').slice(0, 1600) } : null;
    }).filter((item: SearchHit | null): item is SearchHit => Boolean(item));
  } catch { return null; }
}

export async function searchWeb(query: string) {
  let successfulEmpty: { provider: 'tavily' | 'serpapi' } | null = null;
  if (process.env.TAVILY_API_KEY) {
    const results = await searchTavily(query);
    if (results?.length) return { results, provider: 'tavily' as const, configured: true };
    if (results) successfulEmpty = { provider: 'tavily' };
  }
  if (process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY) {
    const results = await searchSerpApi(query);
    if (results?.length || !successfulEmpty && results) return { results: results || [], provider: 'serpapi' as const, configured: true };
    if (results) successfulEmpty = { provider: 'serpapi' };
  }
  if (successfulEmpty) return { results: [] as SearchHit[], provider: successfulEmpty.provider, configured: true };
  return { results: [] as SearchHit[], provider: null, configured: false };
}
