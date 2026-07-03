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

// Costruisce un deep-link con i soli filtri attivi in query-string.
export function buildShareUrl(base: string, f: ShareFilters): string {
  const p = new URLSearchParams();
  if (f.query) p.set('q', f.query);
  if (f.lingua) p.set('lingua', f.lingua);
  if (f.size) p.set('size', f.size);
  if (f.produttore) p.set('prod', f.produttore);
  if (f.top) p.set('top', f.top);
  const chips = [
    f.promo && 'promo',
    f.full && 'full',
    f.withPhoto && 'withphoto',
    f.noPhoto && 'nophoto',
  ].filter(Boolean) as string[];
  if (chips.length) p.set('chips', chips.join(','));
  if (f.vmin) p.set('vmin', f.vmin);
  if (f.vmax) p.set('vmax', f.vmax);
  if (f.ymin) p.set('ymin', f.ymin);
  if (f.ymax) p.set('ymax', f.ymax);
  if (f.sort && f.sort !== 'added-desc') p.set('sort', f.sort);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

// Legge i filtri da una query-string (window.location.search). Inverso del build.
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
  const chips = (p.get('chips') ?? '').split(',').filter(Boolean);
  if (chips.includes('promo')) out.promo = true;
  if (chips.includes('full')) out.full = true;
  if (chips.includes('withphoto')) out.withPhoto = true;
  if (chips.includes('nophoto')) out.noPhoto = true;
  return out;
}
