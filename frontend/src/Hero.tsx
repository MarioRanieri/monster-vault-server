import type { Stats } from './computeStats';

// Hero della collection (classi .hero/.hero-*/.stats-row del vecchio): titolo,
// conteggio grande e riga di statistiche. Presentazionale (aggregati via props).
export function Hero({ stats }: { stats: Stats }) {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-label">Your Collection</div>
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
      </div>
    </section>
  );
}
