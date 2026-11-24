'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight, BookOpenCheck, BriefcaseBusiness, Compass, FileText,
  Files, LayoutDashboard, Menu, PanelsTopLeft, Settings2, Shuffle,
  Sparkles, X, LogOut, MessageCircle, Send,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type Status = {
  groq: 'live' | 'dev';
  tavily: 'live' | 'dev';
  serpapi: 'live' | 'dev';
  supabase: 'live' | 'dev';
  schema_ready: boolean;
  storage_ready: boolean;
  missing_dependencies: string[];
  development_mode: boolean;
  demo_label: string;
};

const nav = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/career', label: 'My Career', icon: Compass },
  { href: '/learning', label: 'Learning & Growth', icon: BookOpenCheck },
  { href: '/opportunities', label: 'Career Opportunities', icon: BriefcaseBusiness },
  { href: '/assistant', label: 'AI Career Assistant', icon: Sparkles },
  { href: '/documents', label: 'Career Documents', icon: Files },
  { href: '/cv-studio', label: 'AI CV Studio', icon: FileText },
  { href: '/transition', label: 'Career Transition', icon: Shuffle },
  { href: '/applications', label: 'My Applications', icon: PanelsTopLeft },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatReply, setChatReply] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => value && setStatus(value))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = await createBrowserSupabase();
      await supabase.auth.signOut();
    } catch {
      // Keep the UI honest and navigate to sign-in even if the remote session is unavailable.
    }
    router.push('/login');
    router.refresh();
  }

  async function askQuick(event: React.FormEvent) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatBusy(true); setChatReply(''); setChatInput('');
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history: [] }) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'The assistant could not respond.');
      }
      if (!response.body) throw new Error('No assistant response was returned.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let answer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        answer += decoder.decode(value, { stream: true }); setChatReply(answer);
      }
    } catch (error) { setChatReply(error instanceof Error ? error.message : 'The assistant could not respond.'); }
    finally { setChatBusy(false); }
  }

  const initial = email.trim().charAt(0).toUpperCase() || 'I';

  return (
    <div className="app-shell">
      <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} hidden={!open} />
      <aside className={`app-sidebar ${open ? 'open' : ''}`} aria-label="Dashboard navigation">
        <div className="sidebar-brand">
          <Link href="/overview" className="brand-lockup" aria-label="Isoprise workspace" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/isoprise-logo.png" alt="Isoprise" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
            <span className="sr-only">Isoprise</span>
            <small style={{ padding: '2px 6px', background: 'var(--green-soft)', color: 'var(--green-dark)', borderRadius: 999, fontWeight: 750, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Workspace</small>
          </Link>
        </div>
        <div className="sidebar-label">Your workspace</div>
        <nav className="nav-list">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon aria-hidden="true" /> <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-mission">
            <small>ACCESS · DEVELOPMENT · EMPLOYABILITY</small>
            <p>One connected path from learning opportunities to a career you can build.</p>
          </div>
          <button className="nav-link" onClick={signOut} disabled={signingOut} style={{ marginTop: 10, width: '100%', border: 0, background: 'transparent', textAlign: 'left' }}>
            <LogOut aria-hidden="true" /><span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button button button-quiet button-small" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen((value) => !value)}>
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
            <span className="topbar-kicker">A career companion for your next step <ArrowUpRight size={12} style={{ verticalAlign: '-2px' }} /></span>
          </div>
          <div className="topbar-user">
            <div className="user-avatar" aria-hidden="true">{initial}</div>
            <div><div className="user-name">{email || 'Your account'}</div><div className="user-caption">Your career workspace</div></div>
          </div>
        </header>
        <main className="app-content">
          {status?.development_mode && (
            <div className="development-banner" role="status">
              <span aria-hidden="true">◷</span>
              <div><strong>DEVELOPMENT MODE</strong>Some required integrations, verification schema or private storage are not ready. {status.missing_dependencies.length > 0 && <>Missing: {status.missing_dependencies.join(', ')}. </>}{status.demo_label}</div>
            </div>
          )}
          {children}
        </main>
      </div>
      <div className="assistant-widget">
        {chatOpen && <section className="assistant-popover" role="dialog" aria-label="Quick AI Career Assistant">
          <div className="assistant-popover-header"><div><strong>AI Career Assistant</strong><small>Profile-aware guidance</small></div><button type="button" aria-label="Close assistant" onClick={() => setChatOpen(false)}><X size={16} /></button></div>
          <div className="assistant-popover-body" aria-live="polite">{chatReply || 'Ask about your next learning step, skill gaps or verified career opportunities.'}{chatBusy && <span className="assistant-typing"> · thinking…</span>}</div>
          <form className="assistant-popover-form" onSubmit={askQuick}><input aria-label="Ask a career question" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask a quick question…" maxLength={2000} /><button type="submit" aria-label="Send question" disabled={chatBusy || !chatInput.trim()}><Send size={15} /></button></form>
          <Link href="/assistant" className="assistant-full-link">Open full conversation <ArrowUpRight size={12} /></Link>
        </section>}
        <button className="assistant-bubble" aria-label={chatOpen ? 'Close AI Career Assistant' : 'Open AI Career Assistant'} aria-expanded={chatOpen} onClick={() => setChatOpen((value) => !value)}><MessageCircle size={20} /></button>
      </div>
    </div>
  );
}
