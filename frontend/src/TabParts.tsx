import type { TabPart } from './colorizeTab';
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
