import type { TabDisplay, TabPart } from './colorizeTab';
import { keyed } from './keyed';

// Parti del tappo ("GOLD/BLACK") separate da "/", ognuna col suo colore.
// Era copiato in dettaglio, lista e confronto: ora vive qui.
export function TabParts({ parts }: Readonly<{ parts: TabPart[] }>) {
  return (
    <>
      {keyed(parts, (p) => p.text).map(({ key, item: p }, i) => (
        <span key={key}>
          {i > 0 && '/'}
          <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
        </span>
      ))}
    </>
  );
}

// Il tappo come lo si vede ovunque (lista, dettaglio, confronto, form): "top" =
// coperchio → riquadro col suo colore di fondo; "tab" = linguetta → le parti dopo
// lo slash colorate nel testo. Senza un fondo noto (es. SILVER) resta solo testo.
export function TabBadge({ tab }: Readonly<{ tab: TabDisplay }>) {
  if (tab.parts.length === 0) return null;
  const inner = <TabParts parts={tab.parts} />;
  if (!tab.style) return inner;
  return (
    <span className="tab-badge" style={tab.style}>
      {inner}
    </span>
  );
}
