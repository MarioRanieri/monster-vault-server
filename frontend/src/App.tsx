import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCansStore } from './store';
import { CanDetail } from './CanDetail';
import { filterCans, sortCans, filterOptions, type SortKey } from './filterCans';
import { Hero } from './Hero';
import { CollectionFilterBar, type GridMode } from './CollectionFilterBar';
import { CanViews, LoadStatus, Toast, type ToastState } from './AppParts';
import { NO_FILTERS, type Filters } from './appFilters';
import { computeStats, addedThisMonth, latestAdditions } from './computeStats';
import { useAuthStore } from './authStore';
import { LoginForm } from './LoginForm';
import { CanEditForm } from './CanEditForm';
import { LandingPage } from './LandingPage';
import { Header } from './Header';
import { buildShareUrl, parseShareUrl, type ShareFilters } from './shareView';
import { CompareBar } from './CompareBar';
import { ComparePanel } from './ComparePanel';
import { StatsModal } from './StatsModal';
import { ValueCalc } from './ValueCalc';
import { parseCsv } from './csv';
import { buildXlsx, parseXlsx } from './excel';
import { HelpModal } from './HelpModal';
import { Lightbox } from './Lightbox';
import { AccountPanel } from './AccountPanel';
import type { Can } from './types';

// Render incrementale: quante card montare per "pagina" (vedi shownCans).
const PAGE = 60;
// Quante lattine mostrare in "Latest additions" sulla landing.
const LATEST_LIMIT = 8;

function App() {
  const cans = useCansStore((s) => s.cans);
  const loading = useCansStore((s) => s.loading);
  const error = useCansStore((s) => s.error);
  const warming = useCansStore((s) => s.warming);
  const loadCans = useCansStore((s) => s.loadCans);
  const saveCan = useCansStore((s) => s.saveCan);
  const deleteCan = useCansStore((s) => s.deleteCan);
  const restoreCan = useCansStore((s) => s.restoreCan);
  const permanentDeleteCan = useCansStore((s) => s.permanentDeleteCan);
  const createCan = useCansStore((s) => s.createCan);
  const uploadPhoto = useCansStore((s) => s.uploadPhoto);
  const uploadPhotoFromUrl = useCansStore((s) => s.uploadPhotoFromUrl);
  const importCans = useCansStore((s) => s.importCans);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const refresh = useAuthStore((s) => s.refresh);
  const recover = useAuthStore((s) => s.recover);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState<Can | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('added-desc');
  // Chi ha già fatto login su questo browser (mv_auth) salta sempre la splash,
  // anche a sessione nuova. Un guest la salta solo per la sessione corrente
  // (sessionStorage: sopravvive a un refresh ma si azzera chiudendo la tab/app
  // per davvero) — la landing resta comunque raggiungibile dal logo dell'header.
  const [view, setView] = useState<'landing' | 'collection'>(() =>
    localStorage.getItem('mv_auth') || sessionStorage.getItem('mv_seen_landing')
      ? 'collection'
      : 'landing',
  );
  const enterCollection = () => {
    sessionStorage.setItem('mv_seen_landing', '1');
    setView('collection');
  };
  const [showLogin, setShowLogin] = useState(false);
  const [light, setLight] = useState(false);
  const [gridMode, setGridMode] = useState<GridMode>('grid');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [wallPhotos, setWallPhotos] = useState<{ photos: string[]; alt: string } | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  // Hero che collassa allo scroll (mobile): quando il sentinel esce dal viewport
  // in alto, mostra la barra compatta wordmark + conteggio.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Ripristina la sessione solo se questo browser ha già fatto login (hint
    // mv_auth): i guest non chiamano /auth/refresh → niente 401 in console.
    // Il refresh va aspettato PRIMA di loadCans: il backend redige il prezzo
    // per chi non manda un Bearer token, quindi caricare i cans in parallelo
    // (senza aspettare il token) mostrerebbe sempre valore vuoto a un admin
    // che riapre una sessione già autenticata.
    (async () => {
      if (localStorage.getItem('mv_auth')) await refresh();
      loadCans();
    })();
  }, [loadCans, refresh]);

  useEffect(() => {
    document.body.classList.toggle('light', light);
  }, [light]);

  // Deep-link condiviso: al mount rilegge i filtri dalla URL e salta la landing.
  // I filtri non persistono più tra sessioni (chiusura/riapertura app, login,
  // logout devono sempre ripartire da zero) — solo uno share link li applica.
  useEffect(() => {
    const shared = parseShareUrl(globalThis.location.search);
    if (Object.keys(shared).length === 0) return;
    const { sort: s, ...rest } = shared;
    setFilters((prev) => ({ ...prev, ...rest }));
    if (s != null) setSort(s as SortKey);
    setView('collection');
  }, []);

  // JWT admin scaduto a metà sessione (authFetch non è riuscito a rinnovarlo
  // via refresh): riapre da sola il login invece di lasciare solo un toast
  // d'errore sul save fallito con 401.
  useEffect(() => {
    if (!sessionExpired) return;
    useAuthStore.setState({ sessionExpired: false });
    showToast('⚠ Session expired — please log in again');
    setShowLogin(true);
  }, [sessionExpired]);

  const numOrUndef = (s: string) => (s === '' ? undefined : Number(s));
  // Il backend non invia mai `valore` al guest (redatto server-side): un vmin/vmax
  // residuo (share URL o mv_filters di una sessione admin precedente) va ignorato,
  // non applicato a zero — altrimenti svuoterebbe la griglia in modo confuso.
  const normalizedFilters = useMemo(
    () => ({
      ...filters,
      vmin: isAdmin ? numOrUndef(filters.vmin) : undefined,
      vmax: isAdmin ? numOrUndef(filters.vmax) : undefined,
      ymin: numOrUndef(filters.ymin),
      ymax: numOrUndef(filters.ymax),
    }),
    [filters, isAdmin],
  );
  // Ricalcolano su tutte le ~1864 lattine: memoizzati sulle dipendenze reali
  // (prima ricalcolavano ad ogni render, mascherato solo dal render incrementale).
  const options = useMemo(() => filterOptions(cans, normalizedFilters), [cans, normalizedFilters]);
  // Suggerimenti per l'autocomplete del form (CanEditForm): sempre sull'intera
  // collezione, non ristretti dai filtri attivi — altrimenti editare una lattina
  // mentre un filtro è attivo nasconde valori validi (es. un produttore mai
  // usato su size=750ML non verrebbe suggerito con quel filtro attivo).
  const allOptions = useMemo(() => filterOptions(cans), [cans]);
  const suggestions = {
    manufacturers: allOptions.manufacturers,
    sizes: allOptions.sizes,
    countries: allOptions.countries,
    tops: allOptions.tops,
    conditions: [
      ...new Set(cans.map((c) => c.stato?.trim()).filter((v): v is string => Boolean(v))),
    ].sort((a, b) => a.localeCompare(b)),
  };
  const uploadStaged = async (
    id: string,
    uploads: { slot: number; file?: File; url?: string }[],
  ) => {
    for (const u of uploads) {
      if (u.file) await uploadPhoto(id, u.slot, u.file);
      else if (u.url) await uploadPhotoFromUrl(id, u.slot, u.url);
    }
  };
  const visible = useMemo(
    () => sortCans(filterCans(cans, normalizedFilters), sort),
    [cans, normalizedFilters, sort],
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const resetFilters = () => setFilters(NO_FILTERS);
  const selectCan = (can: Can) => {
    setSelectedId(can.id);
    setEditing(false);
  };
  // Card di "Latest additions" sulla landing: entra in collection e apre
  // subito il dettaglio di quella lattina (stessa selectCan usata altrove).
  const selectFromLanding = (can: Can) => {
    enterCollection();
    selectCan(can);
  };
  // ShareFilters non include `stato` (si attiva solo dalle stats, non si condivide).
  const currentFilters: ShareFilters = {
    query: filters.query,
    lingua: filters.lingua,
    size: filters.size,
    produttore: filters.produttore,
    top: filters.top,
    promo: filters.promo,
    full: filters.full,
    withPhoto: filters.withPhoto,
    noPhoto: filters.noPhoto,
    vmin: filters.vmin,
    vmax: filters.vmax,
    ymin: filters.ymin,
    ymax: filters.ymax,
    sort,
  };
  const filtersJson = JSON.stringify(currentFilters);
  // Render incrementale: monta le prime PAGE card, poi cresce quando l'utente
  // arriva in fondo (IntersectionObserver sul sentinel) → evita ~1866 nodi al
  // primo paint. Riparte da capo quando cambiano filtri/sort o i dati.
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [filtersJson, cans.length]);
  // Callback ref sul sentinel: (dis)connette l'IntersectionObserver esattamente
  // quando il nodo monta/smonta, senza dipendere dal timing degli effetti.
  // rootMargin carica la pagina successiva ~600px prima del fondo (preload).
  const ioRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    ioRef.current?.disconnect();
    if (node && typeof IntersectionObserver !== 'undefined') {
      ioRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) setShown((n) => n + PAGE);
        },
        { rootMargin: '600px' },
      );
      ioRef.current.observe(node);
    }
  }, []);
  // Sentinel per l'hero sticky: fuori dal viewport (in alto) → mostra la compatta.
  const stickyIoRef = useRef<IntersectionObserver | null>(null);
  const stickySentinelRef = useCallback((node: HTMLDivElement | null) => {
    stickyIoRef.current?.disconnect();
    if (node && typeof IntersectionObserver !== 'undefined') {
      stickyIoRef.current = new IntersectionObserver((entries) =>
        setScrolled(!entries[0].isIntersecting),
      );
      stickyIoRef.current.observe(node);
    }
  }, []);
  const shownCans = visible.slice(0, shown);
  const shareCurrentView = () => {
    const url = buildShareUrl(
      globalThis.location.origin + globalThis.location.pathname,
      currentFilters,
    );
    void navigator.clipboard?.writeText(url);
    setToast({ msg: '🔗 View link copied' });
    setTimeout(() => setToast(null), 2000);
  };
  const toggleCompare = (id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return ids.length >= 4 ? ids : [...ids, id];
    });
  };
  const compareCans = compareIds
    .map((id) => cans.find((c) => c.id === id))
    .filter((c): c is Can => Boolean(c));
  const showToast = (msg: string) => {
    setToast({ msg });
    setTimeout(() => setToast(null), 2500);
  };
  // saveCan/createCan lanciano `Error("HTTP <status>")` (vedi store.ts): distingue
  // le cause più comuni invece del testo fisso "Could not save changes" per ogni
  // errore, sia di rete che di validazione che di conflitto.
  const saveErrorMessage = (e: unknown): string | null => {
    const status = e instanceof Error ? /^HTTP (\d+)$/.exec(e.message)?.[1] : undefined;
    if (status === '401') return null; // gestito dal flow di sessione scaduta
    if (status === '400') return '⚠ Invalid data — check the fields and try again';
    if (status === '409') return '⚠ Conflict — this can was changed elsewhere, reload and retry';
    if (status) return `⚠ Could not save changes (server error ${status})`;
    return '⚠ Could not save changes — check your connection';
  };
  // Soft-delete con finestra di undo di 10s, come la vecchia app: Undo → restore
  // dello snapshot; scaduto il timer → purge definitivo (DB + foto Cloudinary).
  const handleDelete = async (can: Can) => {
    await deleteCan(can.id);
    setEditing(false);
    setSelectedId(null);
    const purge = setTimeout(() => {
      permanentDeleteCan(can.id).catch(() => {});
      setToast(null);
    }, 10000);
    setToast({
      msg: 'Can deleted',
      onUndo: async () => {
        clearTimeout(purge);
        try {
          await restoreCan(can);
          showToast('Restored ✓');
        } catch {
          showToast('⚠ Restore failed');
        }
      },
    });
  };
  // Click su una voce delle stats: chiude il modal, azzera i filtri e applica
  // solo quello scelto (come il vecchio statsFilter), con toast e scroll su.
  const statsFilter = (field: string, value: string) => {
    const boolField =
      field === 'promo' || field === 'full' || field === 'withPhoto' || field === 'noPhoto';
    setFilters({ ...NO_FILTERS, [field]: boolField ? true : value } as Filters);
    setShowStats(false);
    showToast(`Filter: ${value}`);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  };
  const exportExcel = async () => {
    const buf = await buildXlsx(visible);
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monster_vault_export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 Excel exported');
  };
  // Import per estensione: .xlsx/.xls (anche i backup della vecchia app) o .csv.
  const importFile = async (file: File) => {
    const parsed = file.name.toLowerCase().endsWith('.csv')
      ? parseCsv(await file.text())
      : await parseXlsx(await file.arrayBuffer());
    await importCans(parsed);
    showToast(`📥 Imported ${parsed.length} cans`);
  };
  const selected = cans.find((c) => c.id === selectedId) ?? null;
  const stats = computeStats(cans);

  const handleLogin = async (u: string, p: string) => {
    await login(u, p);
    if (useAuthStore.getState().isAdmin) {
      setShowLogin(false);
      resetFilters();
      // Il caricamento iniziale (guest) ha il prezzo redatto dal backend: va
      // ricaricato ora col Bearer token per mostrare i valori reali.
      loadCans();
    }
  };

  if (view === 'landing') {
    return (
      <LandingPage
        total={stats.total}
        countries={stats.countries}
        addedThisMonth={addedThisMonth(cans)}
        latest={latestAdditions(cans, LATEST_LIMIT)}
        loading={loading}
        onEnter={enterCollection}
        onSelect={selectFromLanding}
        onAdmin={() => {
          // Già admin (sessione attiva) → entra dritto, niente password.
          // Guest → entra e apre il login.
          enterCollection();
          if (!isAdmin) setShowLogin(true);
        }}
      />
    );
  }

  return (
    <main>
      <a href="#main-content" className="skip-link">
        Skip to cans
      </a>
      <Header
        isAdmin={isAdmin}
        onSignOut={() => {
          logout();
          resetFilters();
          setView('landing');
        }}
        onLogoHome={() => setView('landing')}
        onAdd={() => setCreating({ id: crypto.randomUUID(), nome: '' })}
        onLogin={() => setShowLogin(true)}
        onToggleTheme={() => setLight((v) => !v)}
        onGuide={() => setShowGuide(true)}
        onExport={exportExcel}
        onImport={importFile}
        onAccount={() => setShowAccount(true)}
      />
      <Hero
        stats={stats}
        isAdmin={isAdmin}
        onStats={() => setShowStats(true)}
        onValue={isAdmin ? () => setShowValue(true) : undefined}
      />
      {/* Azioni di vista subito sotto le stat dell'hero (prima erano in fondo,
          nella riga grid-info ora rimossa). */}
      <div className="collection-actions">
        {isAdmin && (
          <button
            type="button"
            className="share-view-btn"
            aria-pressed={showPrice}
            onClick={() => setShowPrice((v) => !v)}
          >
            € {showPrice ? 'Hide prices' : 'Show prices'}
          </button>
        )}
        <button type="button" className="share-view-btn" onClick={shareCurrentView}>
          🔗 Share view
        </button>
      </div>
      {/* Sentinel: quando esce dal viewport in alto, l'hero è "scrollato via" e
          compare la barra compatta. La FilterBar è avvolta in un contenitore
          sticky (mobile) così ricerca + viste/sort restano a portata. */}
      <div ref={stickySentinelRef} aria-hidden="true" className="sticky-sentinel" />
      <div className="sticky-controls">
        <div className={`hero-compact${scrolled ? ' show' : ''}`} aria-hidden="true">
          <span className="hero-compact-mark">
            MONSTER <span>VAULT</span>
          </span>
          <span className="hero-compact-count">{stats.total} cans</span>
        </div>
        <CollectionFilterBar
          filters={filters}
          onFilters={setFilters}
          options={options}
          stats={stats}
          noValueCount={cans.filter((c) => !c.valore).length}
          sort={sort}
          onSort={setSort}
          gridMode={gridMode}
          onGridMode={setGridMode}
          isAdmin={isAdmin}
          onReset={hasFilters ? resetFilters : undefined}
        />
      </div>
      <div id="main-content" tabIndex={-1}>
        <LoadStatus loading={loading} warming={warming} error={error} />
        <CanViews
          cans={shownCans}
          mode={gridMode}
          showPrice={isAdmin && showPrice}
          sort={sort}
          onSelect={selectCan}
          canEdit={isAdmin}
          onEdit={(can) => {
            setSelectedId(can.id);
            setEditing(true);
          }}
          onWall={setWallPhotos}
        />
        {shown < visible.length && <div ref={sentinelRef} aria-hidden="true" />}
      </div>
      {selected &&
        (editing ? (
          <CanEditForm
            can={selected}
            title="Edit Can"
            suggestions={suggestions}
            onSave={async (canData, uploads) => {
              try {
                const saved = await saveCan(canData);
                try {
                  await uploadStaged(saved.id, uploads);
                  showToast('Can updated ✓');
                } catch {
                  showToast('⚠ Some photos could not be uploaded');
                }
                setEditing(false);
              } catch (e) {
                const msg = saveErrorMessage(e);
                if (msg) showToast(msg);
              }
            }}
            onCancel={() => setEditing(false)}
            onDelete={() => handleDelete(selected)}
          />
        ) : (
          <CanDetail
            can={selected}
            onClose={() => setSelectedId(null)}
            isAdmin={isAdmin}
            showPrice={isAdmin && showPrice}
            onEdit={() => setEditing(true)}
            onDelete={() => handleDelete(selected)}
            inCompare={compareIds.includes(selected.id)}
            onToggleCompare={() => toggleCompare(selected.id)}
            onToast={showToast}
            allCans={cans}
            navCans={visible}
            onSelect={selectCan}
          />
        ))}
      {creating && (
        <CanEditForm
          can={creating}
          title="Add Can"
          suggestions={suggestions}
          onSave={async (canData, uploads) => {
            try {
              const saved = await createCan(canData);
              try {
                await uploadStaged(saved.id, uploads);
                showToast('Can added ✓');
              } catch {
                showToast('⚠ Some photos could not be uploaded');
              }
              setCreating(null);
            } catch (e) {
              const msg = saveErrorMessage(e);
              if (msg) showToast(msg);
            }
          }}
          onCancel={() => setCreating(null)}
        />
      )}
      {showLogin && (
        <LoginForm
          onLogin={handleLogin}
          error={authError}
          onGuest={() => setShowLogin(false)}
          onRecover={recover}
        />
      )}
      <CompareBar
        cans={compareCans}
        onRemove={toggleCompare}
        onOpen={() => setShowCompare(true)}
        onClear={() => setCompareIds([])}
      />
      {showCompare && compareCans.length >= 2 && (
        <ComparePanel cans={compareCans} isAdmin={isAdmin} onClose={() => setShowCompare(false)} />
      )}
      {showStats && (
        <StatsModal
          cans={cans}
          stats={stats}
          onClose={() => setShowStats(false)}
          isAdmin={isAdmin}
          onFilter={statsFilter}
          onSelect={(can) => {
            setShowStats(false);
            setSelectedId(can.id);
            setEditing(false);
          }}
        />
      )}
      {showValue && <ValueCalc cans={visible} onClose={() => setShowValue(false)} />}
      {showGuide && <HelpModal onClose={() => setShowGuide(false)} />}
      {showAccount && <AccountPanel onClose={() => setShowAccount(false)} />}
      {wallPhotos && (
        <Lightbox
          photos={wallPhotos.photos}
          alt={wallPhotos.alt}
          onClose={() => setWallPhotos(null)}
        />
      )}
      {toast && <Toast toast={toast} />}
    </main>
  );
}

export default App;
