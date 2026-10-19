import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty } from '../components/ui';
import { actions } from '../lib/actions';
import { inTown, townLabel } from './Home';

export default function Study() {
  const { data, town, user, isStaff, needSignIn, openSheet, toast, refresh } = useApp();
  const [subject, setSubject] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const all = data.groups.filter(inTown(town));
  const subjects = [...new Set(all.map((g) => g.subject))];
  const list = all.filter((g) => subject === 'all' || g.subject === subject);

  const toggle = async (groupId: string, joined: boolean) => {
    if (needSignIn('join') || !user) return;
    setBusy(groupId);
    const r = joined ? await actions.leaveGroup(groupId, user.id) : await actions.joinGroup(groupId);
    setBusy(null);
    if (!r.ok) { toast(r.error); return; }
    toast(joined ? 'You left the group' : 'You joined the group');
    refresh();
  };

  return (
    <>
      <h2>Study hub</h2>
      <Link className="card" to="/ask?mode=school"><span className="ic"><Icon name="spark" /></span>
        <span className="body"><span className="name">Homework help</span><span className="meta">Ask about any CAPS subject. It explains step by step instead of just giving answers.</span></span><Icon name="chev" /></Link>
      <div className="between"><h3>Study groups in {townLabel(town)}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => { if (!needSignIn('group')) openSheet({ kind: 'newGroup' }); }}><Icon name="plus" />Create</button></div>
      {subjects.length > 1 && (
        <div className="chips" role="group" aria-label="Subject">
          {['all', ...subjects].map((s) => <button key={s} className="chip" aria-pressed={subject === s} onClick={() => setSubject(s)}>{s === 'all' ? 'All subjects' : s}</button>)}
        </div>
      )}
      <section className="sec">
        {list.length ? list.map((g) => {
          const joined = !!user && g.members.includes(user.id);
          return (
            <div key={g.id} className="card col">
              <span className="tag">{g.subject} · {g.grade}</span>
              <span className="name">{g.title}</span>
              <span className="meta row" style={{ gap: 6 }}><Icon name={g.isOnline ? 'msg' : 'pin'} />{g.place}{g.town ? ` · ${g.town}` : ''}</span>
              <span className="meta row" style={{ gap: 6 }}><Icon name="clock" />Next session: {g.nextSession}</span>
              {g.contact && <span className="meta row" style={{ gap: 6 }}><Icon name="phone" />{g.contact}</span>}
              {(isStaff || g.ownerId === user?.id) && <button className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openSheet({ kind: 'editGroup', id: g.id })}>Edit group</button>}
              <div className="between full">
                <span className="meta row" style={{ gap: 6 }}><Icon name="users" />{g.members.length} learner{g.members.length === 1 ? '' : 's'}</span>
                <button className="btn btn-ghost btn-sm" aria-pressed={joined} disabled={busy === g.id} onClick={() => toggle(g.id, joined)}>
                  {joined ? <><Icon name="check" />Joined</> : 'Join group'}</button>
              </div>
            </div>
          );
        }) : <Empty title="No study groups here yet"><span className="small muted">Start one for your subject and invite classmates.</span></Empty>}
      </section>
    </>
  );
}
