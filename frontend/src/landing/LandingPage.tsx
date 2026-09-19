import type { Can } from '../app/types';
import { CanGrid } from '../cans/CanGrid';

// Splash iniziale (struttura/classi del vecchio #landing-overlay): scelta guest
// vs admin + link alla mappa. Presentazionale: stats e callback vengono da App.
// Testo del badge "attività del mese": singolare/plurale o nessuna novità.
function monthNotice(n: number): string {
  if (n <= 0) return 'no new cans added this month';
  return `${n} ${n === 1 ? 'can' : 'cans'} added this month`;
}

export function LandingPage({
  total,
  countries,
  addedThisMonth,
  latest,
  loading = false,
  onEnter,
  onAdmin,
  onSelect,
}: Readonly<{
  total: number;
  countries: number;
  addedThisMonth: number;
  latest: Can[];
  loading?: boolean;
  onEnter: () => void;
  onAdmin: () => void;
  onSelect: (can: Can) => void;
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

        <p className="land-tagline">
          RedMghost&rsquo;s personal Monster Energy archive — every can catalogued and mapped across
          the world.
        </p>

        <div className="land-bar" aria-hidden="true" />

        <div className="land-stats">
          {/* "…" durante il primo load: i totali a 0 sui deploy freschi sembravano un bug */}
          <div className="land-stat">
            <b>{loading ? '…' : total}</b>
            <span>Cans</span>
          </div>
          <span className="land-stat-div" />
          {/* Countries invece di "With photo": in vetrina racconta la stessa storia
              di tagline e mappa ("mapped across the world"), più d'impatto per un visitatore. */}
          <div className="land-stat">
            <b>{loading ? '…' : countries}</b>
            <span>Countries</span>
          </div>
        </div>

        {/* Badge "attività del mese": alimentato dal createdAt immutabile. Durante il
            primo load non lo mostriamo (dato non attendibile finché le lattine non arrivano). */}
        {!loading && (
          <div className="land-notice">
            <span className="land-live" aria-hidden="true" />
            {monthNotice(addedThisMonth)}
          </div>
        )}

        <div className="land-btns">
          <button type="button" className="land-btn-enter" onClick={onEnter}>
            <span>ENTER THE COLLECTION</span>
            <span className="land-btn-sub">Guest mode</span>
          </button>
          <button type="button" className="land-btn-admin" onClick={onAdmin}>
            ADMIN ACCESS
          </button>
        </div>

        <a className="land-map-link" href="/map.html">
          Explore the world map &rarr;
        </a>

        {/* Anteprima delle ultime aggiunte, stesso pattern di "Other cans from
            this country" in CanDetail: solo quando i dati sono pronti e ce ne
            sono, altrimenti sotto la landing resterebbe uno spazio vuoto. */}
        {!loading && latest.length > 0 && (
          <section className="detail-related land-latest" aria-label="Latest additions">
            <h2 className="detail-related-title">Latest additions</h2>
            <CanGrid cans={latest} showPrice={false} onSelect={onSelect} />
          </section>
        )}

        <div className="land-footer">
          <span>Built by Mario Ranieri &middot; Spring Boot + React</span>
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
