import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom';
import { useApp } from './state/AppContext';
import { Icon } from './components/Icon';
import { DAYS, clock } from './lib/hours';
import Home from './pages/Home';
import Services from './pages/Services';
import Market from './pages/Market';
import Study from './pages/Study';
import Ask from './pages/Ask';
import Profile from './pages/Profile';
import Manage from './pages/Manage';
import SheetHost from './sheets/SheetHost';

const TABS = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/services', label: 'Services', icon: 'more' },
  { to: '/market', label: 'Market', icon: 'tag' },
  { to: '/study', label: 'Study', icon: 'book' },
  { to: '/ask', label: 'Ask', icon: 'spark' },
];

function Header() {
  const { now, isStaff, myBusinesses } = useApp();
  const c = clock(now);
  return (
    <header className="top wrap">
      <div className="logo"><Icon name="pin" /></div>
      <div className="brand"><b>VillageLink</b><span>Nkomazi, connected.</span></div>
      <div className="clock" title="South African Standard Time"><b>{c.label}</b>{DAYS[c.day].slice(0, 3)} · SAST</div>
      {isStaff || myBusinesses.size ? (
        <Link className="iconbtn" to="/manage" aria-label={isStaff ? 'Manage VillageLink' : 'My business'}><Icon name="gear" /></Link>
      ) : null}
      <Link className="iconbtn" to="/profile" aria-label="Profile and business plans"><Icon name="user" /></Link>
    </header>
  );
}

export default function App() {
  const { toastMsg, closeSheet } = useApp();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); closeSheet(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main className="wrap" id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/market" element={<Market />} />
          <Route path="/study" element={<Study />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}>
            <Icon name={t.icon} />{t.label}
          </NavLink>
        ))}
      </nav>
      <SheetHost />
      {toastMsg ? <div className="toast" role="status">{toastMsg}</div> : null}
    </div>
  );
}
