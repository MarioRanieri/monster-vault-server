import type { Stats } from './computeStats';

// Barra riassuntiva della collezione. Presentazionale: aggregati via props.
export function StatsBar({ stats }: { stats: Stats }) {
  return (
    <dl className="stats">
      <div>
        <dt>Totale</dt>
        <dd>{stats.total}</dd>
      </div>
      <div>
        <dt>Con foto</dt>
        <dd>{stats.withPhoto}</dd>
      </div>
      <div>
        <dt>In promo</dt>
        <dd>{stats.promo}</dd>
      </div>
    </dl>
  );
}
