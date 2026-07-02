// Header della collection (classi .header/.logo/.header-right/.btn del vecchio):
// logo + toggle tema + Map; guest → "Admin access", admin → Add + utente + Sign out.
// I bottoni feature-only del vecchio (Export/Import/Scan/Guide/Value) arriveranno
// con le rispettive funzioni.
export function Header({
  isAdmin,
  onSignOut,
  onAdd,
  onLogin,
  onToggleTheme,
}: {
  isAdmin: boolean;
  onSignOut: () => void;
  onAdd: () => void;
  onLogin: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <header className="header">
      <div className="logo">
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
      </div>
      <div className="header-right">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Cambia tema"
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
        </button>
        <a className="btn btn-ghost" href="/map.html">
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
        {isAdmin ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
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
            <div className="header-user">
              <span className="header-user-name">Admin</span>
              <button type="button" className="logout-btn" onClick={onSignOut} title="Sign out">
                <span className="btn-label">Sign out</span>
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onLogin}>
            Admin access
          </button>
        )}
      </div>
    </header>
  );
}
