import { useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { SheetHeader } from '../components/ui';
import { BusinessSheet, EditBusinessSheet, ImportSheet, OrderSheet } from './BusinessSheets';
import { ListingSheet, NewGroupSheet, NewListingSheet, PlanRequestSheet } from './CommunitySheets';
import AuthSheet from './AuthSheet';
import { EditGroupSheet, EditListingSheet, PersonSheet } from './AdminSheets';
import { EditJobSheet, JobSheet } from './JobSheets';

function TownSheet() {
  const { data, town, towns, setTown, closeSheet } = useApp();
  const count = (t: string) => data.businesses.filter((b) => b.isActive && (t === 'all' || b.town === t)).length;
  const pick = (t: string) => { setTown(t); closeSheet(); };
  return (
    <>
      <SheetHeader title="Choose your area" />
      {['all', ...towns].map((t) => (
        <button key={t} className="card" onClick={() => pick(t)}>
          <span className="ic"><Icon name="pin" /></span>
          <span className="body"><span className="name">{t === 'all' ? 'All of Nkomazi' : t}</span>
            <span className="meta">{count(t)} business{count(t) === 1 ? '' : 'es'}</span></span>
          {town === t && <span style={{ color: 'var(--accent)' }}><Icon name="check" /></span>}
        </button>
      ))}
    </>
  );
}

export default function SheetHost() {
  const { sheet, closeSheet } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheet) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [sheet, closeSheet]);

  // Each sheet starts at the top.
  const key = sheet ? JSON.stringify(sheet) : '';
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [key]);

  if (!sheet) return null;
  let content: ReactNode = null;
  switch (sheet.kind) {
    case 'business': content = <BusinessSheet id={sheet.id} />; break;
    case 'order': content = <OrderSheet businessId={sheet.businessId} />; break;
    case 'editBusiness': content = <EditBusinessSheet key={sheet.id ?? 'new'} id={sheet.id} />; break;
    case 'import': content = <ImportSheet />; break;
    case 'listing': content = <ListingSheet id={sheet.id} />; break;
    case 'newListing': content = <NewListingSheet />; break;
    case 'newGroup': content = <NewGroupSheet />; break;
    case 'planRequest': content = <PlanRequestSheet />; break;
    case 'town': content = <TownSheet />; break;
    case 'auth': content = <AuthSheet reason={sheet.reason} initialMode={sheet.mode} />; break;
    case 'editListing': content = <EditListingSheet key={sheet.id} id={sheet.id} />; break;
    case 'editGroup': content = <EditGroupSheet key={sheet.id} id={sheet.id} />; break;
    case 'person': content = <PersonSheet key={sheet.id} id={sheet.id} />; break;
    case 'job': content = <JobSheet key={sheet.id} id={sheet.id} />; break;
    case 'editJob': content = <EditJobSheet key={sheet.id ?? 'new'} id={sheet.id} />; break;
  }
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
      <div className="sheet" role="dialog" aria-modal="true" ref={ref}>
        <div className="grab" />
        {content}
      </div>
    </div>
  );
}
