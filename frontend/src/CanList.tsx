import { useState } from 'react';
import type { Can } from './types';
import { cloudinaryThumb } from './cloudinary';
import { Flags } from './flags';
import { colorizeTab } from './colorizeTab';

type SortKey = 'nome' | 'sku' | 'produttore' | 'lingua' | 'size' | 'top' | 'valore';
const num = (v?: string) => parseFloat(v ?? '') || 0;

// Vista lista/tabella (classi .list-view-wrap/.list-table del vecchio): riga
// interamente cliccabile, flag del paese, miniature Cloudinary, header ordinabili.
// La colonna Value appare solo col toggle "Show prices".
export function CanList({
  cans,
  onSelect,
  showPrice,
}: {
  cans: Can[];
  onSelect?: (can: Can) => void;
  showPrice?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const rows = sort
    ? [...cans].sort((a, b) => {
        if (sort.key === 'valore') return (num(a.valore) - num(b.valore)) * sort.dir;
        return (a[sort.key] ?? '').localeCompare(b[sort.key] ?? '') * sort.dir;
      })
    : cans;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const arrow = (key: SortKey) => (sort?.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');
  const th = (key: SortKey, label: string) => (
    <th className="sortable" onClick={() => toggleSort(key)}>
      {label}
      {arrow(key)}
    </th>
  );
  const renderTab = (top?: string) => {
    if (!top) return '—';
    return colorizeTab(top).parts.map((p, i) => (
      <span key={i}>
        {i > 0 && '/'}
        <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
      </span>
    ));
  };

  return (
    <div className="list-view-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th aria-label="Photo" />
            {th('nome', 'Name')}
            {th('sku', 'SKU')}
            {th('produttore', 'Manufacturer')}
            {th('lingua', 'Country')}
            {th('size', 'Size')}
            {th('top', 'Top/Tab')}
            <th>Status</th>
            {showPrice && th('valore', 'Value')}
          </tr>
        </thead>
        <tbody>
          {rows.map((can) => (
            <tr key={can.id} className="lt-row" onClick={() => onSelect?.(can)}>
              <td className="td-thumb">
                {can.p1 ? (
                  <img
                    className="lt-thumb"
                    src={cloudinaryThumb(can.p1, 96, 96)}
                    alt={can.nome}
                    width={48}
                    height={48}
                  />
                ) : (
                  <span className="lt-nophoto">—</span>
                )}
              </td>
              <td className="td-nome">
                <button type="button" className="lt-name-btn" onClick={() => onSelect?.(can)}>
                  {can.nome || '—'}
                </button>
              </td>
              <td>{can.sku || '—'}</td>
              <td>{can.produttore || '—'}</td>
              <td>{can.lingua ? <Flags lingua={can.lingua} /> : '—'}</td>
              <td>{can.size || '—'}</td>
              <td className="lt-top">{renderTab(can.top)}</td>
              <td className="lt-status">
                {can.promo && <span className="badge badge-promo">{can.promo}</span>}
                {can.stato && <span className="badge badge-stato-ok">{can.stato}</span>}
                {!can.promo && !can.stato && '—'}
              </td>
              {showPrice && <td>{can.valore ? `€${can.valore}` : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
