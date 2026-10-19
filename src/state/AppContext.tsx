import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { emptyData, loadAll, loadOffline, saveOffline, type Data } from '../lib/data';
import { TOWNS } from '../lib/constants';
import type { Role } from '../lib/types';

export type SheetState =
  | { kind: 'business'; id: string }
  | { kind: 'order'; businessId: string }
  | { kind: 'listing'; id: string }
  | { kind: 'newListing' }
  | { kind: 'newGroup' }
  | { kind: 'planRequest' }
  | { kind: 'editBusiness'; id: string | null }
  | { kind: 'import' }
  | { kind: 'town' }
  | { kind: 'auth'; reason?: AuthReason; mode?: AuthMode }
  | { kind: 'editListing'; id: string }
  | { kind: 'editGroup'; id: string }
  | { kind: 'person'; id: string };

export type AuthReason = 'order' | 'post' | 'group' | 'join' | 'report' | 'plan' | 'ask';
export type AuthMode = 'signin' | 'signup' | 'reset' | 'newpass';

interface Profile { role: Role; displayName: string }

interface AppValue {
  data: Data;
  loaded: boolean;
  offlineAt: number | null; // set when showing the saved copy
  refresh: () => Promise<void>;

  user: User | null;
  profile: Profile | null;
  isStaff: boolean; // staff or super user
  isAdmin: boolean; // super user
  towns: string[];
  myBusinesses: Set<string>;
  canManage: (businessId: string) => boolean;

  town: string; // 'all' or a town name
  setTown: (t: string) => void;

  sheet: SheetState | null;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  /** Opens sign-in and returns true when nobody is signed in. */
  needSignIn: (reason: AuthReason) => boolean;

  toast: (msg: string) => void;
  toastMsg: string;
  now: number; // ticks every minute so statuses stay current
}

const Ctx = createContext<AppValue | null>(null);

export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
};

const readTown = () => { try { return localStorage.getItem('villagelink.town') || 'all'; } catch { return 'all'; } };

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [offlineAt, setOfflineAt] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myBusinesses, setMyBusinesses] = useState<Set<string>>(new Set());
  const [town, setTownState] = useState(readTown);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const refresh = useCallback(async () => {
    const id = userIdRef.current;
    try {
      const { data: d, failed } = await loadAll(id);
      if (id !== userIdRef.current) return; // signed in or out while loading
      if (failed && !d.businesses.length) {
        const saved = loadOffline();
        if (saved) { setData(saved.data); setOfflineAt(saved.at); setLoaded(true); return; }
      }
      setData(d);
      setOfflineAt(null);
      if (!failed) saveOffline(d);
    } catch {
      const saved = loadOffline();
      if (saved) { setData(saved.data); setOfflineAt(saved.at); }
      else toast('Can’t reach VillageLink right now. Check your connection.');
    }
    setLoaded(true);
  }, [toast]);

  // Who is signed in, and what they may manage.
  const applyUser = useCallback(async (u: User | null) => {
    userIdRef.current = u?.id ?? null;
    setUser(u);
    if (!u) { setProfile(null); setMyBusinesses(new Set()); return; }
    const [p, m] = await Promise.all([
      supabase.from('profiles').select('role,display_name').eq('id', u.id).maybeSingle(),
      supabase.from('business_members').select('business_id').eq('user_id', u.id),
    ]);
    const role: Role = p.data?.role === 'admin' ? 'admin' : p.data?.role === 'staff' ? 'staff' : 'customer';
    setProfile({ role, displayName: p.data?.display_name ?? '' });
    setMyBusinesses(new Set((m.data ?? []).map((r: { business_id: string }) => r.business_id)));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data: s }) => {
      if (!active) return;
      await applyUser(s.session?.user ?? null);
      await refresh();
    }).catch(() => refresh());
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setSheet({ kind: 'auth', mode: 'newpass' }); return; }
      const u = session?.user ?? null;
      if ((u?.id ?? null) === userIdRef.current) return; // token refresh or the same person
      // Run outside the auth callback, as Supabase recommends.
      setTimeout(() => { applyUser(u).then(refresh); }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [applyUser, refresh]);

  // Keep statuses current, and refresh data every 2 minutes while the app is open.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60000);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 120000);
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); refresh(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const setTown = useCallback((t: string) => {
    setTownState(t);
    try { localStorage.setItem('villagelink.town', t); } catch { /* ignore */ }
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff' || isAdmin;
  const towns = data.towns.length ? data.towns : [...TOWNS];
  const value = useMemo<AppValue>(() => ({
    data, loaded, offlineAt, refresh,
    user, profile, isStaff, isAdmin, towns, myBusinesses,
    canManage: (id) => isStaff || myBusinesses.has(id),
    town, setTown,
    sheet, openSheet: setSheet, closeSheet: () => setSheet(null),
    needSignIn: (reason) => { if (userId) return false; setSheet({ kind: 'auth', reason }); return true; },
    toast, toastMsg, now,
  }), [data, loaded, offlineAt, refresh, user, profile, isStaff, isAdmin, towns, myBusinesses, town, setTown, sheet, userId, toast, toastMsg, now]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
