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

export interface SortControl {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

// Barra filtri (classi .filter-bar/.search-wrap/.filter-select/.filter-chip del
// vecchio): ricerca + dropdown + chip a toggle con conteggio + sort.
export function FilterBar({
  query,
  onQuery,
  chips,
  selects = [],
  sort,
}: {
  query: string;
  onQuery: (q: string) => void;
  chips: Chip[];
  selects?: SelectFilter[];
  sort?: SortControl;
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
      {sort && (
        <div className="filter-tools">
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
        </div>
      )}
    </div>
  );
}
