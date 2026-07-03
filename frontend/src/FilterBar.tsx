export interface Chip {
  key: string;
  label: string;
  cls: string;
  active: boolean;
  count: number;
  onToggle: () => void;
}

export interface SelectFilter {
  key: string;
  allLabel: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

export interface Range {
  key: string;
  sep: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}

export interface SortControl {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export interface ViewToggle {
  value: string;
  onChange: (v: string) => void;
}

// Barra filtri (classi del vecchio): ricerca + dropdown + chip + range + sort +
// reset. I criteri sono passati/gestiti dal genitore.
export function FilterBar({
  query,
  onQuery,
  chips,
  selects = [],
  ranges = [],
  sort,
  onReset,
  view,
}: {
  query: string;
  onQuery: (q: string) => void;
  chips: Chip[];
  selects?: SelectFilter[];
  ranges?: Range[];
  sort?: SortControl;
  onReset?: () => void;
  view?: ViewToggle;
}) {
  return (
    <div className="filter-bar">
      <div className="search-wrap">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          aria-label="Cerca per nome, SKU o note"
          placeholder="Search by name, SKU, notes..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      {selects.map((s) => (
        <select
          key={s.key}
          className="filter-select"
          aria-label={s.allLabel}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
        >
          <option value="">{s.allLabel}</option>
          {s.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={`filter-chip ${chip.cls}${chip.active ? ' active' : ''}`}
          aria-pressed={chip.active}
          onClick={chip.onToggle}
        >
          {chip.label}
          <span className="chip-count">{chip.count}</span>
        </button>
      ))}
      {ranges.map((r) => (
        <div key={r.key} className="vrange-wrap">
          <span className="vrange-sep">{r.sep}</span>
          <input
            type="number"
            className="vrange-input"
            aria-label={`${r.key} min`}
            placeholder={r.minPlaceholder ?? 'min'}
            value={r.min}
            onChange={(e) => r.onMin(e.target.value)}
          />
          <span className="vrange-sep">—</span>
          <input
            type="number"
            className="vrange-input"
            aria-label={`${r.key} max`}
            placeholder={r.maxPlaceholder ?? 'max'}
            value={r.max}
            onChange={(e) => r.onMax(e.target.value)}
          />
        </div>
      ))}
      <div className="filter-tools">
        {onReset && (
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset
          </button>
        )}
        {view && (
          <div className="view-toggle">
            <button
              type="button"
              className={`view-btn${view.value === 'grid' ? ' active' : ''}`}
              aria-label="Vista griglia"
              aria-pressed={view.value === 'grid'}
              onClick={() => view.onChange('grid')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              className={`view-btn${view.value === 'list' ? ' active' : ''}`}
              aria-label="Vista lista"
              aria-pressed={view.value === 'list'}
              onClick={() => view.onChange('list')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {sort && (
          <select
            className="filter-select"
            aria-label="Ordina"
            value={sort.value}
            onChange={(e) => sort.onChange(e.target.value)}
          >
            {sort.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
