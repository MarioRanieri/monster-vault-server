import { useState } from 'react';

// Valori che contengono `query` (case-insensitive), prima quelli che ci iniziano;
// il valore già scritto per intero non si suggerisce. Query vuota = tutti.
export function matchSuggestions(values: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return values.slice(0, limit);
  const hits = values.filter((v) => {
    const l = v.toLowerCase();
    return l !== q && l.includes(q);
  });
  const starts = hits.filter((v) => v.toLowerCase().startsWith(q));
  return [...starts, ...hits.filter((v) => !starts.includes(v))].slice(0, limit);
}

// Campo con suggerimenti a tendina (classi .desc-ac-* del vecchio). Al posto del
// <datalist> nativo: quello filtra solo per prefisso, su un campo già compilato
// non mostra nulla e su iOS è quasi invisibile — questo si comporta uguale ovunque.
export function SuggestInput({
  id,
  value,
  onChange,
  suggestions = [],
  multiline = false,
  placeholder,
}: Readonly<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  multiline?: boolean;
  placeholder?: string;
}>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Il textarea (More Info) ha testi lunghi: niente elenco completo da vuoto.
  const items = open && (value.trim() || !multiline) ? matchSuggestions(suggestions, value) : [];
  const listId = `${id}-ac`;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + items.length) % items.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      // Chiude solo la tendina: il listener globale di useEscapeClose chiuderebbe il modale.
      e.stopPropagation();
      setOpen(false);
    }
  };

  const common = {
    id,
    value,
    placeholder,
    role: 'combobox',
    autoComplete: 'off',
    'aria-autocomplete': 'list' as const,
    'aria-expanded': items.length > 0,
    'aria-controls': listId,
    'aria-activedescendant': active >= 0 ? `${listId}-${active}` : undefined,
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown,
  };

  return (
    <div className="desc-ac-wrap">
      {multiline ? (
        <textarea
          {...common}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
        />
      ) : (
        <input
          {...common}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
        />
      )}
      {items.length > 0 && (
        <div className="desc-ac-list open" id={listId} role="listbox">
          {items.map((v, i) => (
            <div
              key={v}
              id={`${listId}-${i}`}
              role="option"
              // focusabile solo via aria-activedescendant: il focus resta sul campo
              tabIndex={-1}
              aria-selected={i === active}
              className={`desc-ac-item${i === active ? ' active' : ''}`}
              // mousedown (non click): scatta prima del blur che chiuderebbe la lista
              onMouseDown={(e) => {
                e.preventDefault();
                pick(v);
              }}
            >
              {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
