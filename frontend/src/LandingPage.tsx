// Splash iniziale (struttura/classi del vecchio #landing-overlay): scelta guest
// vs admin + link alla mappa. Presentazionale: stats e callback vengono da App.
export function LandingPage({
  total,
  withPhoto,
  onEnter,
  onAdmin,
}: Readonly<{
  total: number;
  withPhoto: number;
  onEnter: () => void;
  onAdmin: () => void;
}>) {
  return (
    // Il CSS vecchio parte da display:none (nel vanilla la mostrava il JS);
    // qui la montiamo in modo condizionale, quindi la forziamo visibile.
    <div id="landing-overlay" style={{ display: 'flex' }}>
      <div className="land-bg" aria-hidden="true" />
      <div className="land-inner">
        <div className="land-eyebrow">
          MONSTER ENERGY ARCHIVE &middot; <b>2026</b>
        </div>

        <div className="land-claw-wrap">
          <img
            className="land-claw"
            src="/monster-claw.jpg"
            alt="Monster claw"
            width={320}
            height={346}
          />
        </div>

        <h1 className="land-wordmark">
          MONSTER <span>VAULT</span>
        </h1>
        <div className="land-sub">The Collection</div>

        <div className="land-bar" aria-hidden="true" />

        <div className="land-stats">
          <div className="land-stat">
            <b>{total}</b>
            <span>Cans</span>
          </div>
          <span className="land-stat-div" />
          <div className="land-stat">
            <b>{withPhoto}</b>
            <span>With photo</span>
          </div>
        </div>

        <div className="land-btns">
          <button type="button" className="land-btn-enter" onClick={onEnter}>
            ENTER THE COLLECTION
            <span className="land-btn-sub">Guest mode</span>
          </button>
          <button type="button" className="land-btn-admin" onClick={onAdmin}>
            ADMIN ACCESS
          </button>
        </div>

        <a className="land-map-link" href="/map.html">
          Explore the world map &rarr;
        </a>

        <div className="land-footer">
          Built by Mario Ranieri &middot; Spring Boot + React
          <a
            href="https://github.com/MarioRanieri/monster-vault-server"
            target="_blank"
            rel="noopener"
            aria-label="GitHub repository"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
