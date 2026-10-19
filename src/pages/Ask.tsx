import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty } from '../components/ui';
import { supabase } from '../lib/supabase';

type Mode = 'local' | 'school';
interface Msg { role: 'user' | 'assistant'; content: string; error?: boolean }

const GRADES = ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Adult learner'];
const SUGGEST: Record<Mode, string[]> = {
  local: ['Which fuel stations are open now?', 'Where can I buy bread near me?', 'Is the clinic open today?', 'Who fixes phones?'],
  school: ['Explain Pythagoras for Grade 9', 'How do I balance a chemical equation?', 'Help me plan an essay on climate change', 'Quiz me on photosynthesis'],
};

export default function Ask() {
  const { user, town, needSignIn } = useApp();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mode') === 'school' ? 'school' : 'local';
  const [grade, setGrade] = useState(() => { try { return localStorage.getItem('villagelink.grade') || 'Grade 10'; } catch { return 'Grade 10'; } });
  const [chats, setChats] = useState<Record<Mode, Msg[]>>({ local: [], school: [] });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = chats[mode];

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, busy]);

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy) return;
    if (needSignIn('ask')) return;
    const history = [...msgs.filter((m) => !m.error), { role: 'user' as const, content: q }];
    setChats((c) => ({ ...c, [mode]: [...c[mode], { role: 'user', content: q }] }));
    setText('');
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('assistant', {
      body: { mode, grade, town, messages: history.slice(-12).map(({ role, content }) => ({ role, content })) },
    });
    setBusy(false);
    let answer: Msg;
    if (error || !data?.text) {
      let msg = 'Something went wrong. Try again.';
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (body?.error) msg = body.error;
        if (body?.code === 'not_configured') setOff(true);
      } catch { /* not JSON */ }
      answer = { role: 'assistant', content: msg, error: true };
    } else answer = { role: 'assistant', content: data.text };
    setChats((c) => ({ ...c, [mode]: [...c[mode], answer] }));
  }

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
      {off && <Empty title="The assistant isn’t switched on yet"><span className="small muted">VillageLink staff need to add the assistant key in Supabase. Everything else in the app works.</span></Empty>}
      <div className="chat">
        {msgs.length ? msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'me' : 'ai'}${m.error ? ' err' : ''}`}>{m.content}</div>
        )) : (
          <div className="stack">
            <span className="small muted">{mode === 'local' ? 'Ask about what’s open, prices at local shops, or the marketplace. Answers use VillageLink’s live information.' : 'Ask about any school subject. Write in English, siSwati, Xitsonga or isiZulu.'}</span>
            {!user && <span className="small muted">You’ll need to sign in to ask a question.</span>}
            <div className="chips" style={{ flexWrap: 'wrap' }}>{SUGGEST[mode].map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )}
        {busy && <div className="msg ai">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea id="askInput" rows={1} maxLength={1500} value={text} aria-label="Your question"
          placeholder={mode === 'local' ? 'Ask about Nkomazi…' : 'Ask a homework question…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button type="submit" className="btn btn-mint" aria-label="Send" disabled={busy}><Icon name="send" /></button>
      </form>
      <p className="foot">Answers can be wrong. Check important details by phone, and use 10111 or 10177 in an emergency.</p>
    </>
  );
}
