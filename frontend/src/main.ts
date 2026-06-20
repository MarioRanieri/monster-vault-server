import './styles/main.css';

import * as core from './core';
import * as ui from './ui';
import * as tools from './tools';
import * as photos from './photos';
import * as share from './share';
import { registerSW } from './pwa';

// ponytail: expose all onclick-referenced functions on window
const W = window as unknown as Record<string, unknown>;

// core
W.signIn = core.signIn;
W.signOut = core.signOut;
W.toggleTheme = core.toggleTheme;
W.togglePwVisibility = core.togglePwVisibility;
W.continueAsGuest = core.continueAsGuest;
W.applyAuthUI = core.applyAuthUI;
W.closeModal = core.closeModal;
W.installApp = core.installApp;
W.toggleViewsMenu = core.toggleViewsMenu;
W.saveCurrentView = core.saveCurrentView;
W.applyView = core.applyView;
W.deleteView = core.deleteView;
W.loadFromCache = core.loadFromCache;
W.jsq = core.jsq;
W.esc = core.esc;
W.updateTopPreview = core.updateTopPreview;

// ui
W.applyFilters = ui.applyFilters;
W.resetFilters = ui.resetFilters;
W.toggleChip = ui.toggleChip;
W.setView = ui.setView;
W.loadMore = ui.loadMore;
W.sortList = ui.sortList;
W.openDetail = ui.openDetail;
W.closeDetail = ui.closeDetail;
W.detailThumbClick = ui.detailThumbClick;
W.toggleCompare = ui.toggleCompare;
W.openComparePanel = ui.openComparePanel;
W.closeComparePanel = ui.closeComparePanel;
W.clearCompare = ui.clearCompare;
W.switchComparePhoto = ui.switchComparePhoto;
W.toggleWatch = ui.toggleWatch;
W.openAddModal = ui.openAddModal;
W.openEdit = ui.openEdit;
W.saveCan = ui.saveCan;
W.deleteCan = ui.deleteCan;
W.suggestDescriptions = ui.suggestDescriptions;
W.loadFromServer = ui.loadFromServer;
W.showDemo = ui.showDemo;
W.boot = ui.boot;
W.updateOGMeta = ui.updateOGMeta;

// tools
W.openStatsModal = tools.openStatsModal;
W.statsFilter = tools.statsFilter;
W.setTimelineMode = tools.setTimelineMode;
W.setTimelineMetric = tools.setTimelineMetric;
W.mostraValore = tools.mostraValore;
W.nascondiValore = tools.nascondiValore;
W.refreshPrices = tools.refreshPrices;
W.updateStats = tools.updateStats;
W.openCalc = tools.openCalc;
W.closeCalc = tools.closeCalc;
W.calcRun = tools.calcRun;
W.calcReset = tools.calcReset;
W.openExportModal = tools.openExportModal;
W.exportExcel = tools.exportExcel;
W.openImportModal = tools.openImportModal;
W.handleExcelInput = tools.handleExcelInput;
W.confirmImport = tools.confirmImport;
W.clearAll = tools.clearAll;

// photos
W.openLightbox = photos.openLightbox;
W.closeLightbox = photos.closeLightbox;
W.lbThumbClick = photos.lbThumbClick;
W.triggerPhoto = photos.triggerPhoto;
W.loadPhoto = photos.loadPhoto;
W.clearPhoto = photos.clearPhoto;
W.editPhoto = photos.editPhoto;
W.peRotate = photos.peRotate;
W.peReset = photos.peReset;
W.peCancel = photos.peCancel;
W.peApply = photos.peApply;
W.pasteUrl = photos.pasteUrl;
W.cleanBrokenPhotos = photos.cleanBrokenPhotos;
W.imgErrCard = photos.imgErrCard;
W.imgErrMain = photos.imgErrMain;

// share
W.openShareModal = share.openShareModal;
W.updateShareUrl = share.updateShareUrl;
W.copyShareUrl = share.copyShareUrl;
W.copyToClipboard = share.copyToClipboard;
W.toggleShareSheet = share.toggleShareSheet;
W.shareCanLink = share.shareCanLink;
W.shareFilteredView = share.shareFilteredView;
W.openAuthOverlay = share.openAuthOverlay;
W.closeLanding = share.closeLanding;
W.restoreAdminMode = share.restoreAdminMode;
W.openHelpModal = share.openHelpModal;

// also expose state for tests and E2E
W._accessToken = null;
Object.defineProperty(W, '_accessToken', {
  get: () => core.getToken(),
  set: (v: string | null) => core.setAccessToken(v),
});
W.state = core.state;
W.cans = core.state.cans;

// boot
ui.boot();
registerSW();
