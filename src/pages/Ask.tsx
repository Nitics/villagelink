import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { supabase } from '../lib/supabase';
import { answer, type ResultRef } from '../lib/agent';
import type { Data } from '../lib/data';

type Mode = 'local' | 'school';
interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean; results?: ResultRef[] }

const GRADES = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Adult learner'];
const SUGGEST: Record<Mode, string[]> = {
  local: ['Is any fuel station open now?', 'Where can I buy bread?', 'Is the clinic open today?', 'Who fixes phones?'],
  school: ['Explain Pythagoras for Grade 9', 'How do I balance a chemical equation?', 'Help me plan an essay on climate change', 'Quiz me on photosynthesis'],
};

export default function Ask() {
  const app = useApp();
  const { user, town, towns, now, needSignIn, openSheet, refresh, loadedAt } = app;
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'school' ? 'school' : 'local';
  const [grade, setGrade] = useState(() => { try { return localStorage.getItem('villagelink.grade') || 'Grade 10'; } catch { return 'Grade 10'; } });
  const [chats, setChats] = useState<Record<Mode, Msg[]>>({ local: [], school: [] });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<Data>(app.data);
  dataRef.current = app.data;
  const msgs = chats[mode];

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, busy]);

  const push = (m: Mode, msg: Msg) => setChats((c) => ({ ...c, [m]: [...c[m], msg] }));

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy) return;
    setText('');

    // Local help: the built-in agent, answering from the live database. Free, no sign-in needed.
    if (mode === 'local') {
      push('local', { role: 'user', content: q });
      setBusy(true);
      // Use data no older than a minute, so statuses are current.
      const fresh = Date.now() - loadedAt > 60000 ? await refresh() : null;
      const a = answer(q, fresh ?? dataRef.current, { now: Date.now(), town, towns, userId: user?.id ?? null });
      setBusy(false);
      push('local', { role: 'assistant', content: a.text, results: a.results });
      return;
    }

    // Homework help: the AI tutor on the server (needs the Anthropic key).
    if (needSignIn('ask')) return;
    const history = [...msgs.filter((m) => !m.error), { role: 'user' as const, content: q }];
    push('school', { role: 'user', content: q });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('assistant', {
      body: { mode, grade, town, messages: history.slice(-12).map(({ role, content }) => ({ role, content })) },
    });
    setBusy(false);
    if (!error && data?.text) { push('school', { role: 'assistant', content: data.text }); return; }
    let msg = 'Something went wrong. Try again.';
    let notOn = false;
    try {
      const body = await (error as { context?: Response })?.context?.json?.();
      if (body?.error) msg = body.error;
      notOn = body?.code === 'not_configured';
    } catch { /* not JSON */ }
    if (notOn) {
      // Until the tutor is switched on, point to study groups for the subject instead.
      const groups = answer(`${q} study group`, dataRef.current, { now, town, towns, userId: user?.id ?? null });
      push('school', { role: 'assistant', content: `Homework help isn’t switched on yet.\n\n${groups.text}`, results: groups.results });
    } else push('school', { role: 'assistant', content: msg, error: true });
  }

  const open = (r: ResultRef) => {
    if (r.kind === 'business') openSheet({ kind: 'business', id: r.id });
    else if (r.kind === 'listing') openSheet({ kind: 'listing', id: r.id });
    else window.location.hash = '#/study';
  };
  const submit = (e: FormEvent) => { e.preventDefault(); ask(text); };

  return (
    <>
      <div className="between"><h2>Ask VillageLink</h2>
        {msgs.length > 0 && <button className="btn btn-line btn-sm" onClick={() => setChats((c) => ({ ...c, [mode]: [] }))}>New chat</button>}</div>
      <div className="seg" role="group" aria-label="Assistant mode">
        <button aria-pressed={mode === 'local'} onClick={() => setParams({}, { replace: true })}>Local help</button>
        <button aria-pressed={mode === 'school'} onClick={() => setParams({ mode: 'school' }, { replace: true })}>Homework help</button>
      </div>
      {mode === 'school' && (
        <label className="field" htmlFor="grade">Your grade
          <select id="grade" value={grade} onChange={(e) => { setGrade(e.target.value); try { localStorage.setItem('villagelink.grade', e.target.value); } catch { /* ignore */ } }}>
            {GRADES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
      )}
      <div className="chat">
        {msgs.length ? msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}`}>
            {m.content}
            {m.results && m.results.length > 0 && (
              <div className="chips" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                {m.results.map((r) => (
                  <button key={`${r.kind}:${r.id}`} className="chip" onClick={() => open(r)}>
                    <Icon name={r.kind === 'business' ? 'pin' : r.kind === 'listing' ? 'tag' : 'book'} size={14} /> {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )) : (
          <div className="stack">
            <span className="small muted">{mode === 'local' ? 'Ask about what’s open, prices at local shops, the marketplace or study groups. Answers come from VillageLink’s live information.' : 'Ask about any school subject. Write in English, siSwati, Xitsonga or isiZulu.'}</span>
            {mode === 'school' && !user && <span className="small muted">You’ll need to sign in to use homework help.</span>}
            <div className="chips" style={{ flexWrap: 'wrap' }}>{SUGGEST[mode].map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {busy && <div className="msg ai">{mode === 'local' ? 'Checking…' : 'Thinking…'}</div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea id="askInput" rows={1} maxLength={1500} value={text} aria-label="Your question"
          placeholder={mode === 'local' ? 'Ask about Nkomazi…' : 'Ask a homework question…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button type="submit" className="btn btn-mint" aria-label="Send" disabled={busy}><Icon name="send" /></button>
      </form>
      <p className="foot">{mode === 'local' ? 'Statuses can change. Phone ahead for long trips, and use 10111 or 10177 in an emergency.' : 'Answers can be wrong. Check important details, and use 10111 or 10177 in an emergency.'}</p>
    </>
  );
}
