export interface Chip {
  key: string;
  label: string;
  cls: string;
  active: boolean;
  count: number;
  onToggle: () => void;
}

// Barra filtri (classi .filter-bar/.search-wrap/.filter-chip del vecchio):
// ricerca + chip a toggle con conteggio. Dropdown/sort arriveranno dopo.
export function FilterBar({
  query,
  onQuery,
  chips,
}: {
  query: string;
  onQuery: (q: string) => void;
  chips: Chip[];
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
    </div>
  );
}
