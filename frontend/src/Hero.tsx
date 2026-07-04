import type { Stats } from './computeStats';

// Hero della collection (classi .hero/.hero-*/.stats-row del vecchio): titolo,
// conteggio grande e riga di statistiche. Presentazionale (aggregati via props).
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
      <div className="hero-count">
        <span>{stats.total}</span> cans
      </div>
      <div className="hero-sub">Monster Energy archive</div>
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-val">{stats.total}</span>
          <span className="stat-lbl">Total</span>
        </div>
        <div className="stat-item">
          <span className="stat-val">{stats.countries}</span>
          <span className="stat-lbl">Countries</span>
        </div>
        <div className="stat-item">
          <span className="stat-val">{stats.withPhoto}</span>
          <span className="stat-lbl">With Photo</span>
        </div>
        <div className="stat-item">
          <span className="stat-val" style={{ color: '#00b4ff' }}>
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
    </section>
  );
}
