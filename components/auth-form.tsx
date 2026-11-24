'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Github, LoaderCircle, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type OAuthState = 'enabled' | 'disabled' | 'unavailable' | null;

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleState, setGoogleState] = useState<OAuthState>(null);
  const [githubState, setGithubState] = useState<OAuthState>(null);
  const registering = mode === 'register';

  useEffect(() => {
    let active = true;
    void fetch('/api/status', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) { if (active) { setGoogleState('unavailable'); setGithubState('unavailable'); } return; }
      const status = await response.json();
      if (active) setGoogleState(status.google_auth_state || (status.google_auth === 'live' ? 'enabled' : 'unavailable'));
      if (active) setGithubState(status.github_auth_state || (status.github_auth === 'live' ? 'enabled' : 'unavailable'));
    }).catch(() => { if (active) { setGoogleState('unavailable'); setGithubState('unavailable'); } });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      const supabase = await createBrowserSupabase();
      if (registering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: name.trim() },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setSuccess('Your account is created. Check your email to confirm it, then sign in.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      router.push('/overview');
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Authentication could not be completed.';
      setError(message.toLowerCase().includes('fetch') ? 'Could not reach Supabase. Check its project URL and Auth configuration.' : message);
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: 'google' | 'github') {
    setBusy(true); setError(''); setSuccess('');
    try {
      const supabase = await createBrowserSupabase();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in is not available. Confirm it is enabled in Supabase Auth.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-heading">
        <Link href="/" className="brand-lockup" aria-label="Isoprise home" style={{ display: 'inline-flex', marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/isoprise-logo.png" alt="Isoprise" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <h1 className="auth-title" id="auth-heading">{registering ? 'Build your next step.' : 'Pick up where you left off.'}</h1>
        <p className="auth-copy">{registering ? 'Create your account to map your skills, find learning opportunities and prepare for the work you want.' : 'Sign in to continue your career development journey.'}</p>

        {(googleState === 'enabled' || githubState === 'enabled') && <>
          <div style={{ display: 'grid', gap: 9, marginBottom: 13 }}>
            {googleState === 'enabled' && <button className="button button-secondary" onClick={() => socialSignIn('google')} type="button" disabled={busy} style={{ width: '100%' }}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <span aria-hidden="true" style={{ fontWeight: 800 }}>G</span>}
              Continue with Google
            </button>}
            {githubState === 'enabled' && <button className="button button-secondary" onClick={() => socialSignIn('github')} type="button" disabled={busy} style={{ width: '100%' }}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <Github size={15} aria-hidden="true" />}
              Continue with GitHub
            </button>}
          </div>
          <div className="divider" />
        </>}
        {googleState === 'disabled' && githubState === 'disabled' && <p className="inline-note" role="status" style={{ marginBottom: 13 }}>Google and GitHub sign-in are not enabled in this Supabase project. Use email and password, or enable the providers in Supabase Auth settings.</p>}
        {(googleState === 'unavailable' || githubState === 'unavailable') && googleState !== 'enabled' && githubState !== 'enabled' && <p className="inline-note" role="status" style={{ marginBottom: 13 }}>Google and GitHub sign-in availability could not be confirmed. Use email and password until Supabase Auth settings are available.</p>}
        <form onSubmit={submit}>
          {registering && <div className="form-field"><label htmlFor="full-name">Full name</label><input className="input" id="full-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></div>}
          <div className="form-field"><label htmlFor="email">Email address</label><input className="input" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} /></div>
          <div className="form-field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={128} /></div>
          {error && <div className="alert-error" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
          {success && <div className="alert-success" role="status" style={{ marginBottom: 14 }}>{success}</div>}
          <button className="button" disabled={busy} type="submit" style={{ width: '100%' }}>
            {busy ? <LoaderCircle size={15} className="spin" /> : registering ? 'Create account' : 'Sign in'}
            {!busy && <ArrowRight size={15} />}
          </button>
        </form>
        <p className="auth-footer">
          {registering ? <>Already have an account? <Link href="/login" style={{ color: 'var(--green-dark)', fontWeight: 750 }}>Sign in</Link></> : <>New to Isoprise? <Link href="/register" style={{ color: 'var(--green-dark)', fontWeight: 750 }}>Create an account</Link></>}
        </p>
        <p className="inline-note" style={{ marginTop: 14 }}><ShieldCheck size={12} style={{ verticalAlign: '-2px' }} /> Your account data is private and tied to your authenticated profile.</p>
        <Link href="/" className="inline-note" style={{ display: 'inline-flex', gap: 5, marginTop: 13, alignItems: 'center' }}><ArrowLeft size={12} /> Back to Isoprise</Link>
      </section>
    </main>
  );
}
