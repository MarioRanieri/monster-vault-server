export interface ShareFilters {
  query: string;
  lingua: string;
  size: string;
  produttore: string;
  top: string;
  promo: boolean;
  full: boolean;
  withPhoto: boolean;
  noPhoto: boolean;
  vmin: string;
  vmax: string;
  ymin: string;
  ymax: string;
  sort: string;
}

// Aggiunge il parametro solo se il valore è valorizzato.
const setIf = (p: URLSearchParams, key: string, value: string) => {
  if (value) p.set(key, value);
};

// Costruisce un deep-link con i soli filtri attivi in query-string.
export function buildShareUrl(base: string, f: ShareFilters): string {
  const p = new URLSearchParams();
  setIf(p, 'q', f.query);
  setIf(p, 'lingua', f.lingua);
  setIf(p, 'size', f.size);
  setIf(p, 'prod', f.produttore);
  setIf(p, 'top', f.top);
  const chips = [
    f.promo && 'promo',
    f.full && 'full',
    f.withPhoto && 'withphoto',
    f.noPhoto && 'nophoto',
  ].filter(Boolean) as string[];
  setIf(p, 'chips', chips.join(','));
  setIf(p, 'vmin', f.vmin);
  setIf(p, 'vmax', f.vmax);
  setIf(p, 'ymin', f.ymin);
  setIf(p, 'ymax', f.ymax);
  if (f.sort !== 'added-desc') setIf(p, 'sort', f.sort);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

// Legge i filtri da una query-string (globalThis.location.search). Inverso del build.
export function parseShareUrl(search: string): Partial<ShareFilters> {
  const p = new URLSearchParams(search);
  const out: Partial<ShareFilters> = {};
  const str = (k: keyof ShareFilters, param: string) => {
    const v = p.get(param);
    if (v) (out as Record<string, unknown>)[k] = v;
  };
  str('query', 'q');
  str('lingua', 'lingua');
  str('size', 'size');
  str('produttore', 'prod');
  str('top', 'top');
  str('vmin', 'vmin');
  str('vmax', 'vmax');
  str('ymin', 'ymin');
  str('ymax', 'ymax');
  str('sort', 'sort');
  const chips = new Set((p.get('chips') ?? '').split(',').filter(Boolean));
  if (chips.has('promo')) out.promo = true;
  if (chips.has('full')) out.full = true;
  if (chips.has('withphoto')) out.withPhoto = true;
  if (chips.has('nophoto')) out.noPhoto = true;
  return out;
}
