import type { Stats } from '../stats/computeStats';

// Hero della collection: titolo + UNA riga compatta (numero grande + resto delle
// stat in linea). Prima il conteggio grande (hero-count) ripeteva se stesso come
// stat-item "Total" nella riga sotto — stesso numero due volte, due righe invece
// di una. Ora "Total" è solo il numero grande, la riga sotto porta il resto.
export function Hero({
  stats,
  isAdmin,
  onStats,
  onValue,
}: Readonly<{
  stats: Stats;
  isAdmin?: boolean;
  onStats?: () => void;
  onValue?: () => void;
}>) {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-label">{isAdmin ? 'Your Collection' : "RedMghost's Collection"}</div>
      <div className="hero-stats-line">
        <div className="hero-count">
          <span>{stats.total}</span> cans
        </div>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">{stats.countries}</span>
            <span className="stat-lbl">Countries</span>
          </div>
          <div className="stat-item">
            <span className="stat-val" style={{ color: '#a855f7' }}>
              {stats.withPhoto}
            </span>
            <span className="stat-lbl">With Photo</span>
          </div>
          <div className="stat-item">
            <span className="stat-val" style={{ color: 'var(--full)' }}>
              {stats.full}
            </span>
            <span className="stat-lbl">Full</span>
          </div>
          {onStats && (
            <div className="stat-item">
              <button type="button" className="stats-btn" onClick={onStats}>
                📊 Stats
              </button>
            </div>
          )}
          {onValue && (
            <div className="stat-item">
              <button type="button" className="stats-btn" onClick={onValue}>
                💰 Value
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
