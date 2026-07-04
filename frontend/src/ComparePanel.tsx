import type { Can } from './types';
import { colorizeTab } from './colorizeTab';

// Pannello di confronto affiancato (classi .compare-panel/.compare-table/
// .compare-row/.compare-cell del vecchio): una colonna per lattina, una riga per
// campo. Est. Value solo da admin.
export function ComparePanel({
  cans,
  isAdmin,
  onClose,
}: Readonly<{
  cans: Can[];
  isAdmin?: boolean;
  onClose: () => void;
}>) {
  const rows: { lbl: string; key: keyof Can; isTop?: boolean; money?: boolean }[] = [
    { lbl: 'SKU', key: 'sku' },
    { lbl: 'Manufacturer', key: 'produttore' },
    { lbl: 'Country / Language', key: 'lingua' },
    { lbl: 'Size', key: 'size' },
    { lbl: 'Top / Tab', key: 'top', isTop: true },
    { lbl: 'Opening', key: 'note' },
    { lbl: 'Condition', key: 'stato' },
    ...(isAdmin ? [{ lbl: 'Est. Value', key: 'valore' as keyof Can, money: true }] : []),
    { lbl: 'Promo', key: 'promo' },
  ];
  const cols = `120px repeat(${cans.length}, minmax(0, 1fr))`;

  return (
    <div className="compare-panel open" role="dialog" aria-label="Compare cans">
      <div className="compare-panel-header">
        <span className="compare-panel-title">Comparing {cans.length} cans</span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="compare-panel-body">
        <div className="compare-table">
          <div className="compare-row" style={{ gridTemplateColumns: cols }}>
            <div className="compare-cell compare-cell-lbl">Photo</div>
            {cans.map((can) => (
              <div key={can.id} className="compare-cell compare-cell-photo">
                {can.p1 ? (
                  <img src={can.p1} alt={can.nome} />
                ) : (
                  <div className="compare-cell-photo-ph">—</div>
                )}
              </div>
            ))}
          </div>
          <div className="compare-row" style={{ gridTemplateColumns: cols }}>
            <div className="compare-cell compare-cell-lbl" />
            {cans.map((can) => (
              <div key={can.id} className="compare-cell compare-cell-name">
                <strong style={{ color: '#ff5555' }}>{can.nome || '—'}</strong>
                {can.sku && <span>{can.sku}</span>}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.lbl} className="compare-row" style={{ gridTemplateColumns: cols }}>
              <div className="compare-cell compare-cell-lbl" style={{ color: 'var(--green)' }}>
                {row.lbl}
              </div>
              {cans.map((can) => {
                const raw = (can[row.key] as string | undefined) || '';
                if (row.isTop && raw) {
                  const tab = colorizeTab(raw);
                  return (
                    <div key={can.id} className="compare-cell compare-cell-val">
                      {tab.parts.map((p, i) => (
                        <span key={i}>
                          {i > 0 && '/'}
                          <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
                        </span>
                      ))}
                    </div>
                  );
                }
                const val = raw && row.money ? `€${raw}` : raw;
                return (
                  <div key={can.id} className="compare-cell compare-cell-val">
                    {val || '—'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
