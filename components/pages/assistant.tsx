'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowUp, Bot, Bookmark, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, Textarea } from '@/components/ui';
import { currentScholarshipYears } from '@/lib/utils';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type Source = { id: string; item_type: 'scholarship' | 'job' | 'learning'; title?: string; url: string };

export function AssistantPage() {
  const { CURRENT_YEAR } = currentScholarshipYears();
  const prompts = useMemo(() => [
    'What should I learn next?',
    'Which scholarships am I eligible for?',
    `Find free AI programmes available to Nigerians in ${CURRENT_YEAR}`,
    'What skills am I missing to become a Machine Learning Engineer?',
    'Review my CV against this job description',
    'Which jobs match my current qualifications?',
    'Help me transition from Data Analysis to Data Science',
  ], [CURRENT_YEAR]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [conversationId, setConversationId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text = input) {
    const message = text.trim();
    if (!message || busy) return;
    const next = [...messages, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: '' }];
    setMessages(next); setInput(''); setBusy(true); setNotice(''); setSources([]);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: messages.slice(-12), conversation_id: conversationId || undefined }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'The assistant could not respond.');
      }
      const nextConversationId = response.headers.get('x-conversation-id');
      if (nextConversationId) setConversationId(nextConversationId);
      const sourceHeader = response.headers.get('x-sources');
      if (sourceHeader) {
        try { setSources(JSON.parse(decodeURIComponent(sourceHeader))); } catch { setSources([]); }
      }
      if (response.headers.get('x-demo-mode') === 'true') setNotice('DEMO DATA - Connect API keys for live results');
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = await response.json();
        throw new Error(result.error || 'Assistant output was not available.');
      }
      if (!response.body) throw new Error('The assistant stream was empty. Please retry.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: answer } : item));
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
      }
      if (!answer.trim()) throw new Error('The assistant returned no answer. Please retry.');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The assistant could not respond.';
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: `I couldn’t complete that response. ${messageText}` } : item));
      setNotice(messageText);
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(); }
  function reset() { setMessages([]); setSources([]); setNotice(''); setConversationId(''); }

  async function saveSource(source: Source) {
    try {
      const response = await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: source.item_type, item_id: source.id, notes: JSON.stringify({ title: source.title, url: source.url }) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Opportunity could not be saved.');
      setNotice('Opportunity saved to My Applications.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Opportunity could not be saved.'); }
  }

  return (
    <>
      <header className="page-heading"><div><div className="page-eyebrow">Personalized guidance</div><h1 className="page-title">AI Career Assistant</h1><p className="page-description">Ask about learning, funding, skill gaps, CV fit and career transitions. Answers draw on your saved profile and verified sources.</p></div><Button variant="secondary" size="sm" onClick={reset} disabled={busy}><RotateCcw size={13} /> New conversation</Button></header>
      <Card className="span-12">
        <CardHeader><div><CardTitle>Your career context, not generic advice</CardTitle><div className="card-subtitle">Complete your profile and assessment to make recommendations more relevant.</div></div><Sparkles size={17} color="var(--green)" /></CardHeader>
        {notice && <div className={notice.startsWith('DEMO DATA') ? 'alert-success' : 'alert-error'} role="status" style={{ marginBottom: 13 }}>{notice}</div>}
        <div ref={scrollRef} className="chat-stream" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && <div className="empty-state"><Bot size={19} color="var(--green)" /><p>Start with a question below. If your profile is incomplete, the assistant will ask you to fill it in before giving personalized advice.</p></div>}
          {messages.map((item, index) => <div className={`chat-bubble ${item.role}`} key={`${index}-${item.role}`}>
            {item.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{item.content || (busy && index === messages.length - 1 ? 'Thinking…' : '')}</ReactMarkdown> : item.content}
          </div>)}
        </div>
        {sources.length > 0 && <div style={{ margin: '8px 0 14px' }}><div className="stat-label" style={{ marginBottom: 8 }}>VERIFIED SOURCES</div>{sources.slice(0, 6).map((source, index) => <div className="list-row" key={`${source.url}-${index}`}><a className="list-title" href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'Official source'} ↗</a><Button size="sm" variant="secondary" onClick={() => void saveSource(source)}><Bookmark size={11} /> Save</Button></div>)}</div>}
        {messages.length === 0 && <div className="chip-row" style={{ margin: '12px 0 17px' }}>{prompts.map((prompt) => <button className="prompt-chip" key={prompt} onClick={() => void send(prompt)} disabled={busy}>{prompt}</button>)}</div>}
        <form onSubmit={submit} style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <Textarea aria-label="Ask the AI Career Assistant" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask what to learn next, where to apply, or how to grow…" maxLength={2000} rows={2} style={{ minHeight: 50 }} />
          <Button type="submit" disabled={busy || !input.trim()} aria-label="Send message" style={{ minWidth: 46, paddingInline: 13 }}>{busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUp size={16} />}</Button>
        </form>
        <p className="inline-note" style={{ marginTop: 9 }}>Guidance is informational. Always confirm eligibility and application details with the official source.</p>
      </Card>
    </>
  );
}
