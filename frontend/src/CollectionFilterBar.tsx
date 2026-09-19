import type { Dispatch, SetStateAction } from 'react';
import { FilterBar, type Range } from './FilterBar';
import type { Filters } from './appFilters';
import type { FilterOptions, SortKey } from './filterCans';
import type { Stats } from './stats/computeStats';

export type GridMode = 'grid' | 'list' | 'wall';

// Il guest non riceve mai `valore` dal backend: ordinare per valore non farebbe
// nulla (tutti pari) e sarebbe solo un controllo morto.
const sortOptions = (isAdmin: boolean) => [
  { value: 'added-desc', label: 'RECENTLY PHOTOGRAPHED' },
  { value: 'nome-asc', label: 'NAME A→Z' },
  { value: 'lingua-asc', label: 'COUNTRY A→Z' },
  ...(isAdmin
    ? [
        { value: 'valore-desc', label: 'VALUE ↓' },
        { value: 'valore-asc', label: 'VALUE ↑' },
      ]
    : []),
];

// Guest: niente filtro di prezzo — il backend non invia `valore`, e in passato
// il min/max permetteva di dedurlo per tentativi (bug reale).
function priceRange(
  isAdmin: boolean,
  filters: Filters,
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void,
): Range[] {
  if (!isAdmin) return [];
  return [
    {
      key: 'price',
      sep: '€',
      min: filters.vmin,
      max: filters.vmax,
      onMin: (v) => setFilter('vmin', v),
      onMax: (v) => setFilter('vmax', v),
    },
  ];
}

// FilterBar collegata allo stato dei filtri di App: ricerca, dropdown, chip,
// range, sort, "No value" (admin) e switch di vista.
export function CollectionFilterBar({
  filters,
  onFilters,
  options,
  stats,
  noValueCount,
  sort,
  onSort,
  gridMode,
  onGridMode,
  isAdmin,
  onReset,
}: Readonly<{
  filters: Filters;
  onFilters: Dispatch<SetStateAction<Filters>>;
  options: FilterOptions;
  stats: Stats;
  noValueCount: number;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  gridMode: GridMode;
  onGridMode: (m: GridMode) => void;
  isAdmin: boolean;
  onReset?: () => void;
}>) {
  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onFilters((f) => ({ ...f, [k]: v }));
  return (
    <FilterBar
      query={filters.query}
      onQuery={(v) => setFilter('query', v)}
      selects={[
        {
          key: 'lingua',
          allLabel: 'ALL COUNTRIES',
          value: filters.lingua,
          options: options.countries,
          onChange: (v) => setFilter('lingua', v),
        },
        {
          key: 'size',
          allLabel: 'ALL SIZES',
          value: filters.size,
          options: options.sizes,
          onChange: (v) => setFilter('size', v),
        },
        {
          key: 'produttore',
          allLabel: 'ALL MANUFACTURERS',
          value: filters.produttore,
          options: options.manufacturers,
          onChange: (v) => setFilter('produttore', v),
        },
        {
          key: 'top',
          allLabel: 'ALL TOPS/TABS',
          value: filters.top,
          options: options.tops,
          onChange: (v) => setFilter('top', v),
        },
      ]}
      chips={[
        {
          key: 'promo',
          label: 'Promo',
          cls: 'filter-chip-promo',
          active: filters.promo,
          count: stats.promo,
          onToggle: () => setFilter('promo', !filters.promo),
        },
        {
          key: 'full',
          label: 'FULL',
          cls: 'filter-chip-full',
          active: filters.full,
          count: stats.full,
          onToggle: () => setFilter('full', !filters.full),
        },
        {
          key: 'withPhoto',
          label: 'With photo',
          cls: 'filter-chip-withphoto',
          active: filters.withPhoto,
          count: stats.withPhoto,
          // withPhoto e noPhoto sono mutuamente esclusivi.
          onToggle: () => onFilters((f) => ({ ...f, withPhoto: !f.withPhoto, noPhoto: false })),
        },
        {
          key: 'noPhoto',
          label: 'No photo',
          cls: 'filter-chip-nophotos',
          active: filters.noPhoto,
          count: stats.total - stats.withPhoto,
          onToggle: () => onFilters((f) => ({ ...f, noPhoto: !f.noPhoto, withPhoto: false })),
        },
      ]}
      sort={{
        value: sort,
        options: sortOptions(isAdmin),
        onChange: (v) => onSort(v as SortKey),
      }}
      ranges={[
        ...priceRange(isAdmin, filters, setFilter),
        {
          key: 'year',
          sep: '📅',
          min: filters.ymin,
          max: filters.ymax,
          onMin: (v) => setFilter('ymin', v),
          onMax: (v) => setFilter('ymax', v),
          minPlaceholder: 'from',
          maxPlaceholder: 'to',
        },
      ]}
      onReset={onReset}
      noValueToggle={
        isAdmin
          ? {
              active: filters.noValue,
              count: noValueCount,
              onToggle: () => setFilter('noValue', !filters.noValue),
            }
          : undefined
      }
      view={{ value: gridMode, onChange: (v) => onGridMode(v as GridMode) }}
    />
  );
}
