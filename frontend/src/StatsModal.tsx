import { useState } from 'react';
import type { Can } from './types';
import {
  statsBreakdown,
  buildTimelineData,
  buildYearlyData,
  buildTopValue,
  type Stats,
  type Freq,
  type TimelinePoint,
} from './computeStats';
import { statoBadgeClass } from './statoBadge';
import { cloudinaryThumb } from './cloudinary';

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

// Reset dei default dei <button>: le voci cliccabili (legenda, barre, card)
// riusano il layout delle vecchie <div onclick>.
const btnReset = {
  background: 'transparent',
  border: 0,
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

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

// Barre della timeline in SVG (porta di tools.ts:renderTimelineChart).
function TimelineChart({
  data,
  isYears,
  isValue,
}: Readonly<{ data: TimelinePoint[]; isYears: boolean; isValue: boolean }>) {
  if (!data.length) return <div className="view-empty">No dated cans yet.</div>;
  const pick = (d: TimelinePoint) => (isValue ? d.v : d.n);
  const maxVal = Math.max(...data.map(pick)) || 1;
  const BW = isYears ? 44 : 32;
  const GAP = 6;
  const BARH = 80;
  const LABELH = 20;
  const totalW = data.length * (BW + GAP) - GAP;
  return (
    <svg
      viewBox={`0 0 ${totalW} ${BARH + LABELH}`}
      style={{ minWidth: totalW, height: BARH + LABELH, display: 'block' }}
    >
      {data.map((d, i) => {
        const v = pick(d);
        const h = Math.max(3, (v / maxVal) * BARH);
        const x = i * (BW + GAP);
        const y = BARH - h;
        const label = isYears ? d.k : `${d.k.slice(5)}/${d.k.slice(2, 4)}`;
        return (
          <g key={d.k}>
            <rect
              x={x}
              y={y}
              width={BW}
              height={h}
              rx={3}
              fill="var(--green)"
              fillOpacity={v ? 0.85 : 0.15}
            >
              <title>
                {d.k}: {isValue ? `€${Math.round(d.v)}` : `${d.n} cans`}
              </title>
            </rect>
            {v > 0 && (
              <text x={x + BW / 2} y={y - 5} textAnchor="middle" fontSize={9} fill="var(--green)">
                {isValue ? `€${Math.round(d.v)}` : d.n}
              </text>
            )}
            <text
              x={x + BW / 2}
              y={BARH + LABELH - 2}
              textAnchor="middle"
              fontSize={isYears ? 9 : 8}
              fill="var(--text3)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// "Added over time": toggle 12 months/By year; metrica € Value solo admin
// (il capitolato guest esclude i prezzi).
function Timeline({ cans, isAdmin }: Readonly<{ cans: Can[]; isAdmin: boolean }>) {
  const [mode, setMode] = useState<'months' | 'years'>('months');
  const [metric, setMetric] = useState<'count' | 'value'>('count');
  if (!cans.some((c) => c.updatedAt)) return null;
  const data = mode === 'years' ? buildYearlyData(cans) : buildTimelineData(cans);
  const tab = (active: boolean, label: string, onClick: () => void) => (
    <button type="button" className={`tl-tab${active ? ' active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="chart-section">
      <div
        className="chart-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          Added over time
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>
            based on last update
          </span>
        </span>
        <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <span className="tl-tabs">
              {tab(metric === 'count', 'Count', () => setMetric('count'))}
              {tab(metric === 'value', '€ Value', () => setMetric('value'))}
            </span>
          )}
          <span className="tl-tabs">
            {tab(mode === 'months', '12 months', () => setMode('months'))}
            {tab(mode === 'years', 'By year', () => setMode('years'))}
          </span>
        </span>
      </div>
      <div style={{ overflowX: 'auto', padding: '4px 0' }}>
        <TimelineChart
          data={data}
          isYears={mode === 'years'}
          isValue={isAdmin && metric === 'value'}
        />
      </div>
    </div>
  );
}

// Top 10 per valore (solo admin: contiene €); click → apre il dettaglio.
function TopValue({ cans, onSelect }: Readonly<{ cans: Can[]; onSelect?: (can: Can) => void }>) {
  const rows = buildTopValue(cans, 10);
  if (!rows.length) return null;
  return (
    <div className="chart-section">
      <div className="chart-title">🏆 Top {rows.length} most valuable</div>
      <div>
        {rows.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect?.(c)}
            style={{
              ...btnReset,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 4px',
              width: '100%',
              borderBottom: '1px solid rgba(255,255,255,.05)',
            }}
          >
            <span style={{ width: 22, textAlign: 'right', color: 'var(--text3)', fontSize: 11 }}>
              {i + 1}
            </span>
            {c.p1 ? (
              <img
                src={cloudinaryThumb(c.p1, 72, 72)}
                alt=""
                loading="lazy"
                style={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  background: 'var(--bg3)',
                  borderRadius: 6,
                }}
              />
            ) : (
              <span
                style={{
                  width: 36,
                  height: 36,
                  background: 'var(--bg3)',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
              {c.nome || '—'}
              <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 10.5 }}>
                {' '}
                · SKU {c.sku || '—'}
              </span>
            </span>
            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12.5 }}>
              €{(Number.parseFloat(c.valore ?? '') || 0).toLocaleString('en-US')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Modal statistiche (classi .modal-backdrop/.stats-modal/.chart-section/.bar-*
// del vecchio): tile riepilogo, coverage foto, sezioni donut+barre cliccabili
// (click → filtro sulla griglia), Condition, Top value (admin) e timeline.
export function StatsModal({
  cans,
  stats,
  onClose,
  isAdmin = false,
  onFilter,
  onSelect,
}: Readonly<{
  cans: Can[];
  stats: Stats;
  onClose: () => void;
  isAdmin?: boolean;
  onFilter?: (field: string, value: string) => void;
  onSelect?: (can: Can) => void;
}>) {
  const pct = stats.total ? Math.round((stats.withPhoto / stats.total) * 100) : 0;

  const sections: { title: string; field: string; data: Freq[] }[] = [
    {
      title: 'By country / language',
      field: 'lingua',
      data: statsBreakdown(cans, (c) => c.lingua, 15),
    },
    { title: 'By size', field: 'size', data: statsBreakdown(cans, (c) => c.size, 15) },
    {
      title: 'By manufacturer',
      field: 'produttore',
      data: statsBreakdown(cans, (c) => c.produttore, 15),
    },
  ];
  const conditions = statsBreakdown(cans, (c) => c.stato, 10);

  const tile = (num: React.ReactNode, label: string, color?: string, filter?: [string, string]) => {
    const inner = (
      <>
        <div className="stats-tile-num" style={color ? { color } : undefined}>
          {num}
        </div>
        <div className="stats-tile-lbl">{label}</div>
      </>
    );
    return filter && onFilter ? (
      <button
        type="button"
        className="stats-tile"
        style={{ ...btnReset, textAlign: 'center', background: 'var(--bg3)' }}
        onClick={() => onFilter(filter[0], filter[1])}
      >
        {inner}
      </button>
    ) : (
      <div className="stats-tile">{inner}</div>
    );
  };

  // Card della sezione Condition (e With/No photo): conteggio + badge, cliccabile.
  const conditionCard = (
    n: number,
    badge: React.ReactNode,
    filter: [string, string],
    key: string,
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => onFilter?.(filter[0], filter[1])}
      style={{
        ...btnReset,
        background: 'var(--bg3)',
        borderRadius: 8,
        padding: '12px 18px',
        textAlign: 'center',
        cursor: onFilter ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{n}</div>
      {badge}
      {onFilter && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>click →</div>}
    </button>
  );

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
            {tile(stats.total, 'Total')}
            {tile(stats.promo, 'Promo', '#f5a623', ['promo', 'Promo'])}
            {tile(`${pct}%`, 'With photo', undefined, ['withPhoto', 'With photo'])}
            {tile(stats.full, 'Full', '#8b5cf6', ['full', 'FULL'])}
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
                          <button
                            key={d.k}
                            type="button"
                            className="legend-item"
                            style={btnReset}
                            onClick={() => onFilter?.(sec.field, d.k)}
                          >
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
                            {onFilter && (
                              <span style={{ marginLeft: 4, color: 'var(--text3)', fontSize: 10 }}>
                                →
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bar-chart" style={{ marginTop: 12 }}>
                      {bars.map((d, i) => (
                        <button
                          key={d.k}
                          type="button"
                          className="bar-row"
                          style={{ ...btnReset, width: '100%' }}
                          onClick={() => onFilter?.(sec.field, d.k)}
                        >
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
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {isAdmin && <TopValue cans={cans} onSelect={onSelect} />}

          {conditions.length > 0 && (
            <div className="chart-section">
              <div className="chart-title">Condition</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {conditions.map((d) =>
                  conditionCard(
                    d.n,
                    <span className={`badge ${statoBadgeClass(d.k)}`}>{d.k}</span>,
                    ['stato', d.k],
                    d.k,
                  ),
                )}
                {conditionCard(
                  stats.withPhoto,
                  <span className="badge badge-photo">With photo</span>,
                  ['withPhoto', 'With photo'],
                  '_withphoto',
                )}
                {conditionCard(
                  stats.total - stats.withPhoto,
                  <span
                    className="badge"
                    style={{ background: 'var(--bg4)', color: 'var(--text3)' }}
                  >
                    No photo
                  </span>,
                  ['noPhoto', 'No photo'],
                  '_nophoto',
                )}
              </div>
            </div>
          )}

          <Timeline cans={cans} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
