import type { Can } from './types';

// Vista lista/tabella (classi .list-view-wrap/.list-table del vecchio). Il nome
// è un <button> (accessibile) che apre il dettaglio. Prezzo solo da admin.
export function CanList({
  cans,
  onSelect,
  isAdmin,
}: {
  cans: Can[];
  onSelect?: (can: Can) => void;
  isAdmin?: boolean;
}) {
  return (
    <div className="list-view-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th aria-label="Foto" />
            <th>Name</th>
            <th>SKU</th>
            <th>Manufacturer</th>
            <th>Country</th>
            <th>Size</th>
            {isAdmin && <th>Value</th>}
          </tr>
        </thead>
        <tbody>
          {cans.map((can) => (
            <tr key={can.id}>
              <td className="td-thumb">
                {can.p1 ? (
                  <img className="lt-thumb" src={can.p1} alt={can.nome} width={48} height={48} />
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
              <td>{can.lingua || '—'}</td>
              <td>{can.size || '—'}</td>
              {isAdmin && <td>{can.valore ? `€${can.valore}` : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
