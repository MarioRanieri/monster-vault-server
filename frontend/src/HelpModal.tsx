// Modal guida (classi come StatsModal): breve aiuto sull'uso della collezione.
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Guide">
      <div className="stats-modal">
        <div className="modal-header">
          <div className="modal-title">Guide</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="chart-section">
            <div className="chart-title">Browsing</div>
            <p>
              Search by name, SKU or notes; filter by country, size, manufacturer, tab, promo, full,
              photo status, price and year; sort and switch between grid, list and wall views.
            </p>
          </div>
          <div className="chart-section">
            <div className="chart-title">Compare &amp; stats</div>
            <p>
              Open a can and “Add to compare” (up to 4) to see them side by side. The hero has Stats
              (breakdowns) and, for admins, a Value calculator.
            </p>
          </div>
          <div className="chart-section">
            <div className="chart-title">Views &amp; sharing</div>
            <p>Save a filter combination with “★ Views”, or copy a deep-link with “Share view”.</p>
          </div>
          <div className="chart-section">
            <div className="chart-title">Admin</div>
            <p>
              Sign in to add, edit and delete cans, upload &amp; crop photos (4 slots), watch on
              eBay, and export/import CSV.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
