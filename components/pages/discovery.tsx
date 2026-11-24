'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarDays, ExternalLink, Search, ShieldCheck, Flag, LoaderCircle } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Input } from '@/components/ui';

const categories = [
  ['fully_funded_scholarship', 'Fully funded scholarships'],
  ['partial_scholarship', 'Partial scholarships'],
  ['free_digital_skills', 'Free digital skills programmes'],
  ['technology_fellowship', 'Technology fellowships'],
  ['graduate_development', 'Graduate development programmes'],
  ['international_exchange', 'International exchange programmes'],
  ['research_grant', 'Research grants and research fellowships'],
  ['entrepreneurship_programme', 'Entrepreneurship programmes'],
  ['innovation_challenge', 'Innovation challenges and competitions'],
  ['technology_accelerator', 'Technology accelerator programmes'],
] as const;

type Listing = {
  id: string;
  title: string;
  organization?: string;
  company?: string;
  provider?: string;
  description?: string;
  eligibility?: string;
  application_url?: string | null;
  authorized_portal_url?: string | null;
  source_url?: string;
  url?: string;
  official_source_url?: string;
  funding_category?: string;
  category?: string;
  funding_amount?: string;
  budget_type?: string;
  is_free?: boolean;
  open_date?: string;
  close_date?: string;
  verification_status?: 'verified' | 'pending' | 'expired';
  status?: 'verified' | 'pending' | 'expired';
  created_at?: string;
};

function Verification({ status = 'pending', source }: { status?: Listing['verification_status']; source?: string }) {
  if (status === 'verified') return <span className="verification-badge verified">✓ Verified via official source {source && <a href={source} target="_blank" rel="noreferrer" aria-label="View official verification source"><ExternalLink size={11} /></a>}</span>;
  if (status === 'expired') return <span className="verification-badge expired">Expired · archived</span>;
  return <span className="verification-badge pending">◷ Verification Pending - Apply via official link and confirm</span>;
}

function ListingCard({ item, itemType }: { item: Listing; itemType: 'scholarship' | 'job' | 'learning' }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const status = item.verification_status || item.status || 'pending';
  const organization = item.organization || item.company || item.provider || 'Opportunity provider';
  const applicationLink = status === 'verified' ? item.authorized_portal_url || item.application_url || item.url : item.authorized_portal_url || item.official_source_url || item.source_url || item.url;

  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: itemType, item_id: item.id, notes: JSON.stringify({ title: item.title, organization, url: applicationLink || null, verification_status: status }) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this opportunity.');
      setMessage('Saved to My Applications.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save this opportunity.'); }
    finally { setBusy(false); }
  }

  async function report() {
    const reason = window.prompt('Briefly tell us why this opportunity should be checked:');
    if (!reason?.trim()) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/opportunities/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_type: itemType, opportunity_id: item.id, reason: reason.trim(), evidence_url: applicationLink }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Report could not be submitted.');
      setMessage(result.queue_status === 'pending' ? 'Report sent to the verification queue.' : result.message || 'Report saved, but the verification queue is not available.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Report could not be submitted.'); }
    finally { setBusy(false); }
  }

  return (
    <article className="list-row" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div><div className="list-title">{item.title}</div><div className="list-meta">{organization}{item.funding_category || item.category ? ` · ${String(item.funding_category || item.category).replaceAll('_', ' ')}` : ''}{item.funding_amount ? ` · ${item.funding_amount}` : ''}{item.is_free ? ' · Free' : ''}{item.budget_type ? ` · ${item.budget_type.replace('_', ' ')}` : ''}</div></div>
        <Verification status={status} source={item.official_source_url} />
      </div>
      {item.description && <p style={{ fontSize: 11, color: '#66746c', lineHeight: 1.6, margin: '10px 0' }}>{item.description}</p>}
      {(item.open_date || item.close_date) && <div className="list-meta"><CalendarDays size={11} style={{ verticalAlign: '-2px' }} /> {item.open_date || 'Open now'}{item.close_date ? ` · Closes ${item.close_date}` : ''}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        {applicationLink && status !== 'expired' ? <a className="button button-small" href={applicationLink} target="_blank" rel="noopener noreferrer">{status === 'verified' ? 'Apply via official link' : 'Review source (not verified)'} <ExternalLink size={12} /></a> : <Button size="sm" disabled variant="secondary">{status === 'expired' ? 'Expired listing' : 'Application link unavailable'}</Button>}
        {itemType === 'job' && status !== 'expired' && <Link className="button button-secondary button-small" href={`/cv-studio?job=${encodeURIComponent((item.description || item.title).slice(0, 3500))}`}>Check readiness <ArrowRight size={12} /></Link>}
        <Button size="sm" variant="secondary" onClick={save} disabled={busy}><Bookmark size={12} /> Save</Button>
        {status === 'pending' && <Button size="sm" variant="quiet" onClick={report} disabled={busy}><Flag size={12} /> Report</Button>}
      </div>
      {message && <p className="inline-note" role="status" style={{ marginTop: 9 }}>{message}</p>}
    </article>
  );
}

export function LearningPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [verification, setVerification] = useState('');
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modeNotice, setModeNotice] = useState('');
  const [searched, setSearched] = useState(false);

  async function search(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); setError(''); setModeNotice(''); setSearched(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (budget) params.set('budget', budget);
    if (verification) params.set('verification_status', verification);
    params.set('year', String(new Date().getFullYear()));
    try {
      const response = await fetch(`/api/search/scholarships?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search could not be completed.');
      setModeNotice(data.demo ? data.label || 'DEMO DATA - Connect API keys for live results' : data.cache_only ? 'Live search is unavailable; showing cached listings only.' : '');
      setResults(data.results || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Search could not be completed.'); setResults([]); }
    finally { setLoading(false); }
  }

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Access</div><h1 className="page-title">Learning & Growth</h1><p className="page-description">Find learning, funding and development programmes. Verification status is always visible.</p></div><span className="tag tag-green"><ShieldCheck size={12} /> Verified first</span></header>
      <div className="workspace-grid">
        <Card className="span-4">
          <CardHeader><div><CardTitle>Discover learning</CardTitle><div className="card-subtitle">Filter by funding and official-source status.</div></div></CardHeader>
          <form onSubmit={search}>
            <div className="form-field"><label htmlFor="scholarship-query">Search</label><Input id="scholarship-query" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. AI programme in Nigeria" /></div>
            <div className="form-field"><label htmlFor="funding-category">Funding category</label><select id="funding-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All 10 categories</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="form-field"><label htmlFor="funding-budget">Budget</label><select id="funding-budget" className="select" value={budget} onChange={(e) => setBudget(e.target.value)}><option value="">Any budget</option><option value="free">Free</option><option value="fully_funded">Fully funded</option><option value="partial">Partial</option><option value="paid">Paid</option></select></div>
            <div className="form-field"><label htmlFor="verify-filter">Verification status</label><select id="verify-filter" className="select" value={verification} onChange={(e) => setVerification(e.target.value)}><option value="verified">Verified only</option><option value="pending">Verification pending</option><option value="expired">Expired</option><option value="">All statuses</option></select></div>
            <Button type="submit" disabled={loading} style={{ width: '100%' }}><Search size={14} /> {loading ? 'Searching…' : 'Search programmes'}</Button>
          </form>
          <p className="inline-note" style={{ marginTop: 12 }}>The discovery whitelist helps find sources; it never makes an opportunity verified.</p>
        </Card>
        <Card className="span-8">
          <CardHeader><div><CardTitle>Scholarships & learning opportunities</CardTitle><div className="card-subtitle">Results are ranked with verified records first. Check source links before applying.</div></div><BookOpenCheckIcon /></CardHeader>
          {error && <div className="alert-error" role="alert">{error}</div>}
          {modeNotice && <p className="inline-note" role="status">{modeNotice}</p>}
          {loading && <div className="empty-state"><LoaderCircle size={16} className="spin" /> Searching configured sources…</div>}
          {!loading && searched && results.length === 0 && <div className="empty-state">No matching records were returned. Try a category or search term, include pending listings, or check that the opportunity search provider is configured.</div>}
          {!searched && <div className="empty-state">Choose a category or search term to discover current programmes. Search uses the current year, not a hardcoded year.</div>}
          {!loading && results.map((item) => <ListingCard key={item.id} item={item} itemType={item.url ? 'learning' : 'scholarship'} />)}
          <div style={{ marginTop: 14 }}><Link href="/opportunities" className="inline-note">Explore career opportunities <ArrowRight size={12} style={{ verticalAlign: '-2px' }} /></Link></div>
        </Card>
      </div>
    </>
  );
}

function BookOpenCheckIcon() { return <ShieldCheck size={17} color="var(--green)" />; }

export function OpportunitiesPage() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('any');
  const [verification, setVerification] = useState('');
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modeNotice, setModeNotice] = useState('');
  const [searched, setSearched] = useState(false);

  async function search(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); setError(''); setModeNotice(''); setSearched(true);
    const params = new URLSearchParams({ type: kind, verification_status: verification });
    if (q.trim()) params.set('q', q.trim());
    try {
      const response = await fetch(`/api/search/opportunities?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Opportunity search could not be completed.');
      setModeNotice(data.demo ? data.label || 'DEMO DATA - Connect API keys for live results' : data.cache_only ? 'Live search is unavailable; showing cached listings only.' : '');
      setResults(data.results || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Opportunity search could not be completed.'); setResults([]); }
    finally { setLoading(false); }
  }

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Employability</div><h1 className="page-title">Career Opportunities</h1><p className="page-description">Jobs, internships and graduate programmes with source evidence and readiness tools.</p></div></header>
      <div className="workspace-grid">
        <Card className="span-4">
          <CardHeader><div><CardTitle>Find your next opportunity</CardTitle><div className="card-subtitle">Use filters to narrow down legitimate roles.</div></div></CardHeader>
          <form onSubmit={search}>
            <div className="form-field"><label htmlFor="opportunity-search">Role or skill</label><Input id="opportunity-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Junior data analyst" /></div>
            <div className="form-field"><label htmlFor="opportunity-kind">Opportunity type</label><select id="opportunity-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="any">Any</option><option value="jobs">Jobs</option><option value="internships">Internships</option><option value="graduate">Graduate programmes</option></select></div>
            <div className="form-field"><label htmlFor="opportunity-verification">Verification status</label><select id="opportunity-verification" className="select" value={verification} onChange={(e) => setVerification(e.target.value)}><option value="verified">Verified only</option><option value="pending">Verification pending</option><option value="expired">Expired</option><option value="">All statuses</option></select></div>
            <Button type="submit" disabled={loading} style={{ width: '100%' }}><Search size={14} /> Search opportunities</Button>
          </form>
          <p className="inline-note" style={{ marginTop: 13 }}>Search matches are not proof of legitimacy. Apply only after checking the official source.</p>
        </Card>
        <Card className="span-8">
          <CardHeader><div><CardTitle>Matching opportunities</CardTitle><div className="card-subtitle">Every card shows its verification state and official-source link.</div></div><BriefcaseBusinessIcon /></CardHeader>
          {error && <div className="alert-error" role="alert">{error}</div>}
          {modeNotice && <p className="inline-note" role="status">{modeNotice}</p>}
          {loading && <div className="empty-state"><LoaderCircle size={16} className="spin" /> Searching configured sources…</div>}
          {!loading && searched && results.length === 0 && <div className="empty-state">No matching records were returned. Try a role or skill, include pending listings, or check that the opportunity search provider is configured.</div>}
          {!searched && <div className="empty-state">Search for jobs, internships or graduate programmes. No sample listings are presented as live opportunities.</div>}
          {!loading && results.map((item) => <ListingCard key={item.id} item={item} itemType="job" />)}
        </Card>
      </div>
    </>
  );
}

function BriefcaseBusinessIcon() { return <BriefcaseBusiness size={17} color="var(--green)" />; }
