'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRightLeft, ArrowUpRight, ClipboardList, Database, Download, Flag, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Input } from '@/components/ui';

type TransitionItem = { skill: string; status: 'transferable' | 'strengthen' | 'build_next'; evidence: string | null; evidence_source: string | null; next_action: string };

export function TransitionPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mapping, setMapping] = useState<TransitionItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.profile) {
        setFrom(data.profile.career_interest || '');
        setTo(data.profile.career_goal || '');
      }
    }).catch(() => undefined);
  }, []);

  async function mapSkills(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setMapping([]);
    try {
      const response = await fetch('/api/career/transition-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The transition map could not be created.');
      setMapping(result.mapping || []);
      setNotice(result.mode === 'groq' ? 'Mapped from your saved career evidence and latest assessment.' : 'Rules-based mapping from your saved career evidence; Groq is not available for AI-enhanced mapping.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The transition map could not be created.'); }
    finally { setBusy(false); }
  }

  const labels: Record<TransitionItem['status'], string> = { transferable: 'Transferable', strengthen: 'Strengthen', build_next: 'Build next' };
  const tones: Record<TransitionItem['status'], string> = { transferable: 'tag-green', strengthen: 'tag-amber', build_next: 'tag-red' };
  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Career development</div><h1 className="page-title">Career Transition</h1><p className="page-description">Map the skills you can carry into a new role and make the remaining development steps visible.</p></div></header>
      <div className="workspace-grid">
        <Card className="span-4"><CardHeader><div><CardTitle>Choose a transition</CardTitle><div className="card-subtitle">Start with your current direction and the role you want.</div></div><ArrowRightLeft size={17} color="var(--green)" /></CardHeader>
          <form onSubmit={mapSkills}>
            <div className="form-field"><label htmlFor="transition-from">From</label><Input id="transition-from" value={from} onChange={(event) => setFrom(event.target.value)} maxLength={120} placeholder="e.g. Data Analysis" required /></div>
            <div style={{ textAlign: 'center', color: 'var(--green)', margin: '-3px 0 11px' }}><ArrowRightLeft size={16} /></div>
            <div className="form-field"><label htmlFor="transition-to">To</label><Input id="transition-to" value={to} onChange={(event) => setTo(event.target.value)} maxLength={120} placeholder="e.g. Data Science" required /></div>
            <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Mapping evidence…' : 'Map transferable skills'}</Button>
          </form>
          <p className="inline-note" style={{ marginTop: 11 }}>Only skills supported by your saved evidence are labeled transferable. No sample skills are presented as your own.</p>
          {error && <div className="alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        </Card>
        <Card className="span-8"><CardHeader><div><CardTitle>{from || 'Current direction'} → {to || 'Target role'}</CardTitle><div className="card-subtitle">An evidence-based pathway from your profile—not a profile verdict.</div></div><ArrowUpRight size={17} color="var(--green)" /></CardHeader>
          {notice && <div className="inline-note" role="status" style={{ marginBottom: 12 }}>{notice}</div>}
          {mapping.length === 0 && !busy && <div className="empty-state">Add skills, projects, qualifications or experience in Career Documents, then map a transition using your saved evidence.</div>}
          {busy && <div className="empty-state"><RefreshCw size={14} /> Building a profile-grounded map…</div>}
          {mapping.map((item, index) => <div className="list-row" key={`${item.skill}-${index}`}><div style={{ flex: 1 }}><div className="list-title">{item.skill}</div>{item.evidence && <div className="list-meta">Evidence: {item.evidence} · From: {item.evidence_source}</div>}<div className="list-meta">{item.next_action}</div></div><span className={`tag ${tones[item.status]}`}>{labels[item.status]}</span></div>)}
          {mapping.length > 0 && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', margin: '12px 0 20px' }}>
              <div className="card" style={{ padding: 16, background: '#f8f5fc' }}><div className="stat-label">CURRENT FOUNDATION</div><div className="card-title" style={{ marginTop: 6 }}>{from}</div><p className="inline-note">Evidence from your experience, projects and learning can transfer.</p></div>
              <ArrowRightLeft size={18} color="var(--green)" />
              <div className="card" style={{ padding: 16, background: '#f8f5fc' }}><div className="stat-label">TARGET DIRECTION</div><div className="card-title" style={{ marginTop: 6 }}>{to}</div><p className="inline-note">Build missing depth with focused practice and projects.</p></div>
            </div>
            <div className="alert-success" style={{ marginTop: 14 }}>Review these next steps against a real role description in <Link href="/cv-studio" style={{ fontWeight: 800, textDecoration: 'underline' }}>AI CV Studio</Link>.</div>
          </>}
        </Card>
      </div>
    </>
  );
}

type Application = { id: string; status: string; role_or_title?: string; company_or_org?: string; item_type?: string; item_id?: string; notes?: string; next_action?: string };
type SavedItem = { id: string; item_type: string; item_id: string; notes?: string | null };
function savedDetails(item: SavedItem) {
  try {
    const value: unknown = item.notes ? JSON.parse(item.notes) : null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const details = value as Record<string, unknown>;
      return { title: typeof details.title === 'string' ? details.title : item.item_type, organization: typeof details.organization === 'string' ? details.organization : '', url: typeof details.url === 'string' ? details.url : '' };
    }
  } catch { /* Plain notes may be stored by older clients. */ }
  return { title: item.item_type, organization: '', url: '' };
}
function safeWebLink(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const columns = [
  { status: 'saved', label: 'Saved' },
  { status: 'applied', label: 'Applied' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
];

export function ApplicationsPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [role, setRole] = useState('');
  const [org, setOrg] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [nextActionDraft, setNextActionDraft] = useState<Record<string, string>>({});

  async function refresh() {
    setBusy(true);
    try {
      const [apps, savedItems] = await Promise.all([fetch('/api/applications', { cache: 'no-store' }), fetch('/api/saved', { cache: 'no-store' })]);
      const appData = await apps.json(); const savedData = await savedItems.json();
      if (!apps.ok) throw new Error(appData.error || 'Application records are not available.');
      setItems(appData.items || []); if (savedItems.ok) setSaved(savedData.items || []); setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Application records are not available.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function add(event: FormEvent) {
    event.preventDefault(); if (!role.trim()) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_or_title: role.trim(), company_or_org: org.trim(), status: 'saved' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Application could not be saved.');
      setRole(''); setOrg(''); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Application could not be saved.'); setBusy(false); }
  }

  async function move(item: Application, status: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Status could not be changed.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Status could not be changed.'); setBusy(false); }
  }

  async function saveNextAction(item: Application) {
    setBusy(true);
    try {
      const response = await fetch('/api/applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, next_action: (nextActionDraft[item.id] ?? item.next_action ?? '').trim() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Next action could not be saved.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Next action could not be saved.'); setBusy(false); }
  }

  async function remove(item: Application) {
    if (!window.confirm('Remove this application tracker item?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/applications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Item could not be removed.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Item could not be removed.'); setBusy(false); }
  }

  async function removeSaved(item: SavedItem) {
    if (!window.confirm('Remove this saved opportunity?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/saved', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Saved opportunity could not be removed.'); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Saved opportunity could not be removed.'); setBusy(false); }
  }

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Keep momentum visible</div><h1 className="page-title">My Applications</h1><p className="page-description">Track your next action for jobs, scholarships and learning opportunities.</p></div><Button variant="secondary" size="sm" onClick={refresh} disabled={busy}><RefreshCw size={13} /> Refresh</Button></header>
      <div className="workspace-grid">
        <Card className="span-12"><CardHeader><div><CardTitle>Application tracker</CardTitle><div className="card-subtitle">Move each opportunity through your journey. Additional states include assessment, rejected and withdrawn.</div></div><ClipboardList size={17} color="#008751" /></CardHeader>
          <form onSubmit={add} className="form-row" style={{ alignItems: 'end' }}><div className="form-field"><label htmlFor="app-role">Role, programme or opportunity</label><Input id="app-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Graduate data analyst" maxLength={160} required /></div><div className="form-field"><label htmlFor="app-org">Company or organization</label><Input id="app-org" value={org} onChange={(event) => setOrg(event.target.value)} placeholder="Optional" maxLength={160} /></div><Button type="submit" disabled={busy} style={{ marginBottom: 15 }}><Plus size={14} /> Add to Saved</Button></form>
          {message && <div className="alert-error" role="status" style={{ marginBottom: 13 }}>{message}</div>}
          <div className="kanban">{columns.map((column) => {
            const group = items.filter((item) => item.status === column.status);
            return <section className="kanban-column" key={column.status} aria-label={`${column.label} applications`}>
              <div className="kanban-title"><span>{column.label}</span><span className="tag">{group.length}</span></div>
              {group.length === 0 ? <p className="inline-note">Nothing here yet.</p> : group.map((item) => <article className="kanban-card" key={item.id}><strong>{item.role_or_title || 'Saved opportunity'}</strong><small>{item.company_or_org || item.item_type || 'Opportunity'}</small>{item.notes && <small>{item.notes}</small>}<div style={{ display: 'flex', gap: 6, margin: '8px 0' }}><Input aria-label={`Next action for ${item.role_or_title || 'application'}`} value={nextActionDraft[item.id] ?? item.next_action ?? ''} onChange={(event) => setNextActionDraft((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Next action" maxLength={500} /><Button variant="secondary" size="sm" onClick={() => saveNextAction(item)} disabled={busy}>Save</Button></div><div className="kanban-actions">
                {columns.filter((next) => next.status !== item.status).map((next) => <Button key={next.status} variant="secondary" size="sm" onClick={() => move(item, next.status)} disabled={busy} aria-label={`Move to ${next.label}`}>{next.label}</Button>)}
                <Button variant="quiet" size="sm" onClick={() => remove(item)} disabled={busy} aria-label="Remove tracker item"><Trash2 size={12} /></Button>
              </div></article>)}
            </section>;
          })}</div>
          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 10 }}>Saved scholarships & learning</div>
          {saved.length === 0 ? <div className="empty-state">Save an opportunity or learning programme to keep it here.</div> : <div>{saved.map((item) => {
            const details = savedDetails(item);
            const href = safeWebLink(details.url);
            return <div className="list-row" key={item.id}><div><div className="list-title">{details.title}</div><div className="list-meta">{details.organization ? `${details.organization} · ` : ''}{item.item_type}</div></div><div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>{href && <a className="button button-quiet button-small" href={href} target="_blank" rel="noreferrer">Open <ArrowUpRight size={12} /></a>}<Button variant="quiet" size="sm" onClick={() => removeSaved(item)} disabled={busy} aria-label={`Remove saved ${details.title}`}><Trash2 size={12} /></Button></div></div>;
          })}</div>}
        </Card>
      </div>
    </>
  );
}

export function SettingsPage() {
  const [profile, setProfile] = useState<{ full_name?: string; career_interest?: string; career_level?: string; career_goal?: string; location?: string } | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/profile', { cache: 'no-store' }).then((response) => response.json()).then((data) => { if (data.profile) setProfile(data.profile); else setMessage(data.error || 'Profile details are not available until the Supabase migration is applied.'); }).catch(() => setMessage('Could not load profile settings.')); }, []);

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Your account</div><h1 className="page-title">Settings</h1><p className="page-description">Review your account context and export your own data.</p></div><span className="tag tag-green"><ShieldCheck size={12} /> Private account</span></header>
      <div className="workspace-grid">
        <Card className="span-6"><CardHeader><div><CardTitle>Career preferences</CardTitle><div className="card-subtitle">Update these on My Career to personalize recommendations.</div></div></CardHeader>
          {profile ? <><div className="list-row"><span className="list-meta">Name</span><strong className="list-title">{profile.full_name || 'Not set'}</strong></div><div className="list-row"><span className="list-meta">Career interest</span><strong className="list-title">{profile.career_interest || 'Not set'}</strong></div><div className="list-row"><span className="list-meta">Level</span><strong className="list-title">{profile.career_level || 'Not set'}</strong></div><div className="list-row"><span className="list-meta">Location</span><strong className="list-title">{profile.location || 'Nigeria'}</strong></div><Link href="/career" className="button button-secondary button-small" style={{ marginTop: 15 }}>Edit career profile <ArrowUpRight size={13} /></Link></> : <div className="empty-state">{message || 'Loading settings…'}</div>}
        </Card>
        <Card className="span-6"><CardHeader><div><CardTitle>Privacy & data export</CardTitle><div className="card-subtitle">Download a copy of records linked to your account.</div></div><Download size={17} color="var(--green)" /></CardHeader>
          <p className="inline-note">Export includes your profile, assessments, documents metadata, professional profile, saved items, application tracker, CV metadata and assistant conversations. Private document binaries remain in protected storage.</p>
          <a className="button" href="/api/export" style={{ marginTop: 13 }}>Export my data <Download size={14} /></a>
          <div className="divider" />
          <p className="inline-note">Application access uses Supabase authentication and row-level security. Data is not shared between accounts.</p>
        </Card>
      </div>
    </>
  );
}

const schemaTables = ['profiles', 'assessments', 'documents', 'certificates', 'projects', 'experiences', 'professional_profiles', 'scholarships_cache', 'jobs_cache', 'learning_resources_cache', 'generated_cvs', 'cover_letters', 'saved_items', 'application_tracker', 'assistant_conversations', 'admin_users', 'reported_opportunities', 'verification_queue'];

export function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [message, setMessage] = useState('Checking administrator access…');
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/admin/verification-queue', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) { setAllowed(false); setMessage(data.error || 'Admin access required.'); return; }
      setAllowed(true); setMessage('Admin schema connection is available.'); setPending(data.items?.length ?? 0);
    }).catch(() => { setAllowed(false); setMessage('Admin access could not be verified.'); });
  }, []);

  if (allowed === false) return <Card><CardTitle>Administrator access required</CardTitle><p className="card-subtitle">This area is restricted to users listed in `admin_users`.</p><div className="alert-error" style={{ marginTop: 14 }}>{message}</div><Link href="/overview" className="button button-secondary button-small" style={{ marginTop: 14 }}>Return to Overview <ArrowRightLeft size={13} /></Link></Card>;
  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Platform operations</div><h1 className="page-title">Admin</h1><p className="page-description">A future-ready operations surface backed by the approved schema.</p></div><span className="tag"><Database size={12} /> Database ready</span></header>
      <div className="workspace-grid">
        <Card className="span-12"><CardHeader><div><CardTitle>Coming Soon - Database Ready for Production Admin</CardTitle><div className="card-subtitle">This route is visible only to an authenticated user in admin_users.</div></div><Database size={17} color="var(--green)" /></CardHeader>
          <div className="alert-success" role="status">{message}{pending !== null ? ` · ${pending} items currently awaiting review.` : ''}</div>
          <div className="divider" />
          <div className="stat-label" style={{ marginBottom: 9 }}>SCHEMA</div>
          <div className="admin-schema">{schemaTables.map((table) => `public.${table}`).join('\n')}</div>
          <div className="chip-row" style={{ marginTop: 14 }}>{['Users and roles', 'Reported fake or expired opportunities', 'Learning-program CRUD', 'Expired-listing cron', 'Activity monitoring', 'Pending verification review'].map((feature) => <span className="tag" key={feature}><Flag size={10} /> {feature}</span>)}</div>
        </Card>
      </div>
    </>
  );
}
