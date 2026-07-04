import type { Can } from './types';
import { statsBreakdown, type Stats, type Freq } from './computeStats';

// Palette categoriale del vecchio (le fette identificano categorie, non magnitudini).
const CHART_COLORS = [
  '#a8ff00',
  '#00d4ff',
  '#ff6b00',
  '#ff3cac',
  '#7b2fff',
  '#00ff9d',
  '#ffcc00',
  '#ff5555',
  '#00b8d9',
  '#b3e53d',
];

// Grafico a ciambella (donut) in SVG: una fetta per categoria, buco centrale col
// totale. Portato da tools.ts:donutSVG.
function Donut({ data, total }: Readonly<{ data: Freq[]; total: number }>) {
  const r = 56;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" width="140" height="140" className="donut">
      {data.map((d, i) => {
        const frac = total ? d.n / total : 0;
        const dash = frac * circ;
        const el = (
          <circle
            key={d.k}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth="20"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-(offset * circ)}
            transform="rotate(-90 70 70)"
          >
            <title>
              {d.k}: {d.n}
            </title>
          </circle>
        );
        offset += frac;
        return el;
      })}
      <circle cx="70" cy="70" r="46" fill="var(--bg2)" />
      <text
        x="70"
        y="66"
        textAnchor="middle"
        fontSize="24"
        fill="var(--text)"
        fontFamily="Bebas Neue, sans-serif"
      >
        {total}
      </text>
      <text x="70" y="82" textAnchor="middle" fontSize="10" fill="var(--text3)">
        total
      </text>
    </svg>
  );
}

// Modal statistiche (classi .modal-backdrop/.stats-modal/.chart-section/.bar-*
// del vecchio): tile riepilogo, coverage foto e bar chart per campo. Le barre
// sono un'unica tinta (verde) perché rappresentano la stessa misura (conteggio).
export function StatsModal({
  cans,
  stats,
  onClose,
}: Readonly<{
  cans: Can[];
  stats: Stats;
  onClose: () => void;
}>) {
  const pct = stats.total ? Math.round((stats.withPhoto / stats.total) * 100) : 0;

  const sections: { title: string; data: Freq[] }[] = [
    { title: 'By country / language', data: statsBreakdown(cans, (c) => c.lingua, 15) },
    { title: 'By size', data: statsBreakdown(cans, (c) => c.size, 15) },
    { title: 'By manufacturer', data: statsBreakdown(cans, (c) => c.produttore, 15) },
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

          {sections.map((sec) => {
            const bars = sec.data.slice(0, 15);
            const donutData = sec.data.slice(0, 10);
            const total = bars.reduce((s, d) => s + d.n, 0);
            const maxBar = bars[0]?.n || 1;
            return (
              <div key={sec.title} className="chart-section">
                <div className="chart-title">{sec.title}</div>
                {bars.length === 0 ? (
                  <div className="view-empty">No data</div>
                ) : (
                  <>
                    <div className="donut-wrap">
                      <div className="donut-canvas-wrap">
                        <Donut data={donutData} total={total} />
                      </div>
                      <div className="donut-legend">
                        {donutData.map((d, i) => (
                          <div key={d.k} className="legend-item">
                            <span
                              className="legend-dot"
                              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {d.k}
                            </span>
                            <span className="legend-count">{d.n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bar-chart" style={{ marginTop: 12 }}>
                      {bars.map((d, i) => (
                        <div key={d.k} className="bar-row">
                          <span className="bar-label">{d.k}</span>
                          <div className="bar-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${(d.n / maxBar) * 100}%`,
                                background: CHART_COLORS[i % CHART_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="bar-count">{d.n}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
