import './styles/main.css';

import * as core from './core';
import * as ui from './ui';
import * as tools from './tools';
import * as photos from './photos';
import * as share from './share';
import { registerSW } from './pwa';

// Expose every module export on window so inline onclick handlers and
// cross-module (window as any).fn() bridges resolve. Object.assign over a
// hand-maintained list — the list drifted and broke the site once already.
// ponytail: last-wins on the few duplicated helper names is fine; they're identical.
Object.assign(window, core, ui, tools, photos, share);

// access token lives in a module-private var; expose a getter/setter view for
// tests and E2E that poke window._accessToken directly.
Object.defineProperty(window, '_accessToken', {
  get: () => core.getToken(),
  set: (v: string | null) => core.setAccessToken(v),
});

ui.boot();
registerSW();
