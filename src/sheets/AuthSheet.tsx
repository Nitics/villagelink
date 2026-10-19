import { useState, type FormEvent } from 'react';
import { useApp, type AuthMode, type AuthReason } from '../state/AppContext';
import { Field, SheetHeader } from '../components/ui';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/data';

const WHY: Record<AuthReason, string> = {
  order: 'Sign in to send your order to the shop.', post: 'Sign in to post a listing.', group: 'Sign in to create a study group.',
  join: 'Sign in to join study groups.', report: 'Sign in to report what’s open.', plan: 'Sign in to request a business plan.',
  ask: 'Sign in to ask VillageLink a question.',
};
const TITLE: Record<AuthMode, string> = { signin: 'Sign in', signup: 'Create an account', reset: 'Reset your password', newpass: 'Choose a new password' };
const BUTTON: Record<AuthMode, string> = { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpass: 'Save new password' };

// Where email links come back to: this page, without any #/route.
const back = () => window.location.href.split('#')[0].split('?')[0];

export default function AuthSheet({ reason, initialMode }: { reason?: AuthReason; initialMode?: AuthMode }) {
  const { closeSheet, toast } = useApp();
  const [mode, setMode] = useState<AuthMode>(initialMode ?? 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const switchTo = (m: AuthMode) => { setMode(m); setErr(''); setDone(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode !== 'newpass' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr('Enter a valid email address.');
    if (mode !== 'reset' && password.length < 8) return setErr('Use a password with at least 8 characters.');
    setErr(''); setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setErr(/confirm/i.test(error.message) ? 'Confirm your email first: open the link we sent you, then sign in.' : /invalid/i.test(error.message) ? 'Wrong email or password.' : friendlyError(error));
        closeSheet(); toast('Signed in');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: back() } });
        if (error) return setErr(/registered|exists/i.test(error.message) ? 'An account with this email already exists. Sign in instead.' : friendlyError(error));
        if (data.session) { closeSheet(); toast('Account created'); }
        else setDone(`We sent a confirmation link to ${email.trim()}. Open it, then come back and sign in.`);
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: back() });
        if (error) return setErr(friendlyError(error));
        setDone(`If ${email.trim()} has an account, we sent it a link to reset the password.`);
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return setErr(friendlyError(error));
        closeSheet(); toast('Password changed');
      }
    } finally { setBusy(false); }
  };

  return (
    <>
      <SheetHeader title={TITLE[mode]} />
      {reason && mode !== 'newpass' && <p className="small muted" style={{ margin: 0 }}>{WHY[reason]}</p>}
      {(mode === 'signin' || mode === 'signup') && (
        <div className="seg" role="group" aria-label="Account">
          <button aria-pressed={mode === 'signin'} onClick={() => switchTo('signin')}>Sign in</button>
          <button aria-pressed={mode === 'signup'} onClick={() => switchTo('signup')}>New account</button>
        </div>
      )}
      {done ? <div className="box"><span className="small">{done}</span></div> : (
        <form className="stack" onSubmit={submit} noValidate>
          {mode === 'signup' && <Field label="Your name" id="a_name"><input id="a_name" maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          {mode !== 'newpass' && <Field label="Email" id="a_email"><input id="a_email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
          {mode !== 'reset' && <Field label={mode === 'newpass' ? 'New password' : 'Password'} id="a_pass">
            <input id="a_pass" type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
          {err && <span className="err" role="alert">{err}</span>}
          <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Please wait…' : BUTTON[mode]}</button>
          {mode === 'signin' && <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => switchTo('reset')}>Forgot your password?</button>}
          {mode === 'signup' && <span className="note">Use at least 8 characters. We’ll email you a link to confirm your account.</span>}
        </form>
      )}
    </>
  );
}
