import { useEffect, useRef, useState } from 'react';

// Header della collection (classi .header/.logo/.header-right/.btn del vecchio):
// logo + toggle tema + Map + Guide; guest → "Admin access", admin → Add/Export/
// Import/Account + avatar + Sign out. Ogni bottone testuale ha icona + .btn-label:
// su mobile la label sparisce (main.css `.btn:has(svg) .btn-label`) → riga icon-only.
//
// Su mobile le azioni secondarie (tema, mappa, guida, export, import, account)
// collassano dietro un menu ⋯ (.header-more): restano visibili solo logo, azione
// primaria (Add / Admin access) e la user-pill. Su desktop .header-more e il suo
// menu sono display:contents → i bottoni tornano inline e l'ordine originale è
// ricostruito con `order` (tema1·mappa2·guida3·Add4·export5·import6·account7·user8).

// Icona stroke 14px riusata dai bottoni (stessi path SVG del vecchio index.html).
function Ic({ children, size = 14 }: Readonly<{ children: React.ReactNode; size?: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Header({
  isAdmin,
  onSignOut,
  onLogoHome,
  onAdd,
  onLogin,
  onToggleTheme,
  onGuide,
  onExport,
  onImport,
  onAccount,
}: Readonly<{
  isAdmin: boolean;
  onSignOut: () => void;
  onLogoHome: () => void;
  onAdd: () => void;
  onLogin: () => void;
  onToggleTheme: () => void;
  onGuide?: () => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onAccount?: () => void;
}>) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // Chiudi il menu ⋯ al clic fuori (solo mentre è aperto → un solo listener).
  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  // Azioni secondarie: nel menu ⋯ su mobile, inline su desktop. Gli `order`
  // ricostruiscono l'ordine originale dell'header quando tornano inline.
  const themeBtn = (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      style={{ order: 1 }}
      aria-label="Toggle theme"
      onClick={onToggleTheme}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <span className="btn-label">Theme</span>
    </button>
  );
  const mapLink = (
    <a className="btn btn-ghost" style={{ order: 2 }} href="/map.html" title="View interactive map">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span className="btn-label">Map</span>
    </a>
  );
  const guideBtn = onGuide && (
    <button type="button" className="btn btn-ghost" style={{ order: 3 }} onClick={onGuide}>
      <Ic>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </Ic>
      <span className="btn-label">Guide</span>
    </button>
  );
  const exportBtn = onExport && (
    <button type="button" className="btn btn-ghost" style={{ order: 5 }} onClick={onExport}>
      <Ic>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </Ic>
      <span className="btn-label">Export</span>
    </button>
  );
  const importLabel = onImport && (
    <label className="btn btn-ghost" style={{ order: 6, cursor: 'pointer' }}>
      <Ic>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </Ic>
      <span className="btn-label">Import</span>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        aria-label="Import Excel or CSV"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.currentTarget.value = '';
        }}
      />
    </label>
  );
  const accountBtn = onAccount && (
    <button type="button" className="btn btn-ghost" style={{ order: 7 }} onClick={onAccount}>
      <Ic>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </Ic>
      <span className="btn-label">Account</span>
    </button>
  );

  // Menu overflow ⋯: contenitore + trigger. I figli del menu su desktop tornano
  // inline (display:contents in main.css); su mobile sono un dropdown.
  const overflow = (children: React.ReactNode) => (
    <div className="header-more" ref={moreRef} style={{ order: 10 }}>
      <button
        type="button"
        className="header-more-btn"
        aria-label="More actions"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {/* Il menu si chiude col click fuori (useEffect) o ri-toccando ⋯. */}
      <div className={`header-more-menu${moreOpen ? ' open' : ''}`}>{children}</div>
    </div>
  );

  return (
    <header className="header">
      {/* Logo = home: torna alla landing SENZA fare logout (Sign out è separato).
          <button> e non <div> così è raggiungibile da tastiera/screen-reader. */}
      <button type="button" className="logo" onClick={onLogoHome} aria-label="Monster Vault — home">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#a8ff00" />
          <path d="M16 5L7 27h4.5l1.5-5h6l1.5 5H25L16 5zm-1.5 14l1.5-6 1.5 6h-3z" fill="#000" />
        </svg>
        <div>
          <div className="logo-text">
            MONSTER <span>VAULT</span>
          </div>
          <div className="logo-sub">Collection</div>
        </div>
      </button>
      <div className="header-right">
        {isAdmin ? (
          <>
            <button type="button" className="btn btn-primary" style={{ order: 4 }} onClick={onAdd}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="btn-label">Add</span>
            </button>
            <div className="header-user" style={{ order: 8 }}>
              <span className="header-avatar" aria-hidden="true">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="header-user-name">Admin</span>
              <button type="button" className="logout-btn" onClick={onSignOut} title="Sign out">
                <Ic size={12}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </Ic>
                <span className="btn-label">Sign out</span>
              </button>
            </div>
            {overflow(
              <>
                {themeBtn}
                {mapLink}
                {guideBtn}
                {exportBtn}
                {importLabel}
                {accountBtn}
              </>,
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" style={{ order: 4 }} onClick={onLogin}>
              <Ic>
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </Ic>
              <span className="btn-label">Admin access</span>
            </button>
            {overflow(
              <>
                {themeBtn}
                {mapLink}
                {guideBtn}
              </>,
            )}
          </>
        )}
      </div>
    </header>
  );
}
