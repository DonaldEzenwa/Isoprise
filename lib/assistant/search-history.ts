import type { SupabaseClient } from '@supabase/supabase-js';

type SearchEntry = { query: string; kind: string; category?: string; verification_status?: string; year?: number; searched_at: string };

export async function recordRecentSearch(supabase: SupabaseClient, userId: string, input: Omit<SearchEntry, 'searched_at'>) {
  const query = input.query.trim().slice(0, 160);
  if (!query) return;
  try {
    const { data: latest } = await supabase.from('assistant_conversations').select('id,context_snapshot').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const snapshot = latest?.context_snapshot && typeof latest.context_snapshot === 'object' && !Array.isArray(latest.context_snapshot) ? latest.context_snapshot as Record<string, unknown> : {};
    const previous = Array.isArray(snapshot.recent_searches) ? snapshot.recent_searches as SearchEntry[] : [];
    const recent_searches = [{ ...input, query, searched_at: new Date().toISOString() }, ...previous.filter((item) => item.query !== query || item.kind !== input.kind)].slice(0, 10);
    const context_snapshot = { ...snapshot, recent_searches };
    if (latest?.id) {
      await supabase.from('assistant_conversations').update({ context_snapshot }).eq('id', latest.id).eq('user_id', userId);
    } else {
      await supabase.from('assistant_conversations').insert({ user_id: userId, title: 'Recent search context', messages: [], context_snapshot });
    }
  } catch {
    // Search results remain usable even if recent-search context could not be persisted.
  }
}
