import type { Can } from './types';
import { statsBreakdown, type Stats, type Freq } from './computeStats';

// Modal statistiche (classi .modal-backdrop/.stats-modal/.chart-section/.bar-*
// del vecchio): tile riepilogo, coverage foto e bar chart per campo. Le barre
// sono un'unica tinta (verde) perché rappresentano la stessa misura (conteggio).
export function StatsModal({
  cans,
  stats,
  onClose,
}: {
  cans: Can[];
  stats: Stats;
  onClose: () => void;
}) {
  const pct = stats.total ? Math.round((stats.withPhoto / stats.total) * 100) : 0;

  const sections: { title: string; data: Freq[] }[] = [
    { title: 'By country / language', data: statsBreakdown(cans, (c) => c.lingua, 12) },
    { title: 'By size', data: statsBreakdown(cans, (c) => c.size, 12) },
    { title: 'By manufacturer', data: statsBreakdown(cans, (c) => c.produttore, 12) },
    { title: 'By condition', data: statsBreakdown(cans, (c) => c.stato, 12) },
  ];

  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label="Collection statistics"
    >
      <div className="stats-modal">
        <div className="modal-header">
          <div className="modal-title">Statistics</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="stats-tiles">
            <div className="stats-tile">
              <div className="stats-tile-num">{stats.total}</div>
              <div className="stats-tile-lbl">Total</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num" style={{ color: '#f5a623' }}>
                {stats.promo}
              </div>
              <div className="stats-tile-lbl">Promo</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num">{pct}%</div>
              <div className="stats-tile-lbl">With photo</div>
            </div>
            <div className="stats-tile">
              <div className="stats-tile-num" style={{ color: '#8b5cf6' }}>
                {stats.full}
              </div>
              <div className="stats-tile-lbl">Full</div>
            </div>
          </div>

          <div className="stats-coverage">
            <div className="stats-coverage-head">
              <span>Photo coverage</span>
              <span>
                {stats.withPhoto} / {stats.total} ({pct}%)
              </span>
            </div>
            <div className="stats-coverage-track">
              <div className="stats-coverage-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {sections.map((sec) => (
            <div key={sec.title} className="chart-section">
              <div className="chart-title">{sec.title}</div>
              {sec.data.length === 0 ? (
                <div className="view-empty">No data</div>
              ) : (
                <div className="bar-chart">
                  {sec.data.map((d) => (
                    <div key={d.k} className="bar-row">
                      <span className="bar-label">{d.k}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${(d.n / sec.data[0].n) * 100}%`,
                            background: 'var(--green)',
                          }}
                        />
                      </div>
                      <span className="bar-count">{d.n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
