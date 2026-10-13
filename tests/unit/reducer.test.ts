import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wmReducer } from '../../src/os/wm/reducer';
import { createDesktopState } from '../../src/os/wm/types';
import type { DesktopState, WMAction } from '../../src/os/wm/types';
import { zoneRect } from '../../src/os/wm/geometry';
import { parseLocation } from '../../src/os/url/url';

function run(...actions: WMAction[]): DesktopState {
  return actions.reduce((state, action) => wmReducer(state, action), createDesktopState());
}
const three = () => run({ type: 'OPEN', appId: 'terminal' }, { type: 'OPEN', appId: 'about' }, { type: 'OPEN', appId: 'now' });
const normal = { x: 200, y: 150, w: 720, h: 440 };
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) freeze(item); }
  return value;
}

describe('creation and app instances', () => {
  it('creates independent deterministic initial states', () => {
    expect(createDesktopState()).toEqual({ windows: {}, order: [], focusedId: null,
      viewport: { w: 1440, h: 900 }, seq: 0, showDesktopStash: null, history: 'none' });
    expect(createDesktopState().windows).not.toBe(createDesktopState().windows);
    const viewport = { w: 1024, h: 640 };
    expect(createDesktopState(viewport).viewport).not.toBe(viewport);
  });
  it('opens with the full initial window model and launch origin', () => {
    const state = run({ type: 'OPEN', appId: 'terminal', rect: normal, origin: { x: 40, y: 850 } });
    expect(state.windows.terminal).toEqual({ id: 'terminal', appId: 'terminal', instance: 1,
      route: '', query: {}, title: 'Terminal', rect: normal, restoreRect: normal, mode: 'normal', snap: null,
      minimized: false, closing: false, adopted: false, createdSeq: 1,
      transition: { kind: 'open', seq: 1, origin: { x: 40, y: 850 } } });
    expect(state).toMatchObject({ order: ['terminal'], focusedId: 'terminal', seq: 1, history: 'push' });
  });
  it('adopts exact server geometry without an open animation', () => {
    const state = run({ type: 'OPEN', appId: 'projects', rect: normal, adopted: true, history: 'none' });
    expect(state.windows.projects).toMatchObject({ rect: normal, restoreRect: normal, adopted: true,
      transition: { kind: 'none', seq: 1, origin: null } });
    expect(state.history).toBe('none');
  });
  it.each(['projects', 'about', 'writing', 'maps', 'settings', 'now', 'trash', 'cv', 'messages', 'activity', 'readme'] as const)
    ('opening single-instance %s twice raises the original', (appId) => {
      const first = run({ type: 'OPEN', appId }, { type: 'OPEN', appId: 'terminal' });
      const next = wmReducer(first, { type: 'OPEN', appId, newInstance: true });
      expect(Object.values(next.windows).filter((win) => win.appId === appId)).toHaveLength(1);
      expect(next.focusedId).toBe(appId);
      expect(next.order.at(-1)).toBe(appId);
      expect(next.history).toBe('replace');
      expect(next.windows[appId]).toBe(first.windows[appId]);
    });
  it('Terminal new-window creates terminal~2 and the title suffix', () => {
    const state = run({ type: 'OPEN', appId: 'terminal' }, { type: 'OPEN', appId: 'terminal', newInstance: true });
    expect(state.order).toEqual(['terminal', 'terminal~2']);
    expect(state.windows['terminal~2']).toMatchObject({ instance: 2, title: 'Terminal 2', createdSeq: 2 });
    expect(state.focusedId).toBe('terminal~2');
  });
  it('ordinary Terminal OPEN picks its topmost instance', () => {
    const state = run({ type: 'OPEN', appId: 'terminal' }, { type: 'OPEN', appId: 'terminal', newInstance: true },
      { type: 'FOCUS', id: 'terminal' });
    expect(wmReducer(state, { type: 'OPEN', appId: 'terminal' }).focusedId).toBe('terminal');
    expect(wmReducer(state, { type: 'OPEN', appId: 'terminal' }).order).toHaveLength(2);
  });
  it('reuses the lowest freed instance and reserves closing instances until finish', () => {
    let state = run({ type: 'OPEN', appId: 'terminal' }, { type: 'OPEN', appId: 'terminal', newInstance: true },
      { type: 'CLOSE', id: 'terminal' }, { type: 'OPEN', appId: 'terminal', newInstance: true });
    expect(state.windows['terminal~3']?.title).toBe('Terminal 3');
    state = wmReducer(state, { type: 'FINISH_CLOSE', id: 'terminal' });
    state = wmReducer(state, { type: 'OPEN', appId: 'terminal', newInstance: true });
    expect(state.windows.terminal?.instance).toBe(1);
    expect(state.windows.terminal?.title).toBe('Terminal');
    expect(state.seq).toBeGreaterThan(state.windows['terminal~3']!.createdSeq);
  });
  it('reopens a closing single-instance app without reusing its live close frame', () => {
    const state = run({ type: 'OPEN', appId: 'projects' }, { type: 'CLOSE', id: 'projects' }, { type: 'OPEN', appId: 'projects' });
    expect(state.windows.projects?.closing).toBe(true);
    expect(state.focusedId).toBe('projects~2');
    expect(state.windows['projects~2']?.title).toBe('Projects');
  });
  it('OPEN restores an existing minimized window with a fresh animation sequence', () => {
    const before = run({ type: 'OPEN', appId: 'terminal' }, { type: 'MINIMIZE', id: 'terminal' });
    const next = wmReducer(before, { type: 'OPEN', appId: 'terminal' });
    expect(next.windows.terminal).toMatchObject({ minimized: false, transition: { kind: 'restore', seq: 3 } });
    expect(next.focusedId).toBe('terminal');
    expect(next.history).toBe('replace');
  });
  it('OPEN updates route/query and resets the default title when it navigates', () => {
    const before = run({ type: 'OPEN', appId: 'projects', route: 'salli' }, { type: 'SET_TITLE', id: 'projects', title: 'Salli — Projects' });
    const next = wmReducer(before, { type: 'OPEN', appId: 'projects', route: 'mochi', query: { shot: '2' } });
    expect(next.windows.projects).toMatchObject({ route: 'mochi', query: { shot: '2' }, title: 'Projects', transition: { kind: 'none' } });
    expect(next.history).toBe('push');
    expect(next.seq).toBe(before.seq);
    expect(wmReducer(next, { type: 'OPEN', appId: 'projects', route: 'mochi', query: { shot: '2' } }).history).toBe('replace');
  });
  it('focus-only OPEN preserves app-set titles and respects explicit history', () => {
    const before = run({ type: 'OPEN', appId: 'projects' }, { type: 'SET_TITLE', id: 'projects', title: 'Selected item' });
    expect(wmReducer(before, { type: 'OPEN', appId: 'projects', history: 'none' }).windows.projects?.title).toBe('Selected item');
    expect(wmReducer(before, { type: 'OPEN', appId: 'projects', history: 'push' }).history).toBe('push');
  });
  it.each(['guestbook', 'projects'] as const)('rejects gated or malformed OPEN for %s', (appId) => {
    const state = three();
    expect(wmReducer(state, { type: 'OPEN', appId, ...(appId === 'projects' ? { route: 'bad/route' } : {}) })).toBe(state);
  });
  it('allows the Board only with explicit feature availability', () => {
    expect(wmReducer(createDesktopState(), { type: 'OPEN', appId: 'guestbook' }, { postcards: true }).windows.guestbook?.title).toBe('Board');
  });
});

describe('focus, cycling, minimizing and closing', () => {
  it('FOCUS raises without changing geometry or animating', () => {
    const before = three();
    const state = wmReducer(before, { type: 'FOCUS', id: 'terminal' });
    expect(state.order).toEqual(['about', 'now', 'terminal']);
    expect(state.focusedId).toBe('terminal');
    expect(state.windows.terminal).toBe(before.windows.terminal);
    expect(state.seq).toBe(before.seq);
    expect(wmReducer(state, { type: 'FOCUS', id: 'terminal' })).toBe(state);
  });
  it('FOCUS_DESKTOP leaves stacking untouched', () => {
    const before = three();
    const state = wmReducer(before, { type: 'FOCUS_DESKTOP' });
    expect(state.focusedId).toBeNull();
    expect(state.order).toBe(before.order);
    expect(state.history).toBe('replace');
  });
  it('forward CYCLE rotates A, then B, then C to the front', () => {
    let state = three();
    for (const [id, order] of [
      ['terminal', ['about', 'now', 'terminal']], ['about', ['now', 'terminal', 'about']], ['now', ['terminal', 'about', 'now']],
    ] as const) {
      state = wmReducer(state, { type: 'CYCLE', direction: 1 });
      expect(state.focusedId).toBe(id);
      expect(state.order).toEqual(order);
    }
  });
  it('reverse CYCLE moves the top to the back and focuses the new top', () => {
    let state = three();
    for (const [id, order] of [
      ['about', ['now', 'terminal', 'about']], ['terminal', ['about', 'now', 'terminal']], ['now', ['terminal', 'about', 'now']],
    ] as const) {
      state = wmReducer(state, { type: 'CYCLE', direction: -1 });
      expect(state.focusedId).toBe(id);
      expect(state.order).toEqual(order);
    }
  });
  it.each([1, -1] as const)('CYCLE(%s) excludes minimized and closing windows', (direction) => {
    const before = wmReducer(wmReducer(three(), { type: 'MINIMIZE', id: 'about' }), { type: 'CLOSE', id: 'now' });
    const next = wmReducer(before, { type: 'CYCLE', direction });
    expect(next.focusedId).toBe('terminal');
    expect(next.windows.about?.minimized).toBe(true);
    expect(next.windows.now?.closing).toBe(true);
  });
  it.each([1, -1] as const)('CYCLE(%s) on an empty desktop is safe', (direction) => {
    const next = wmReducer(createDesktopState(), { type: 'CYCLE', direction });
    expect(next.focusedId).toBeNull();
    expect(next.order).toEqual([]);
  });
  it('MINIMIZE retains the window and its position and focuses the next', () => {
    const before = three();
    const next = wmReducer(before, { type: 'MINIMIZE', id: 'now' });
    expect(next.focusedId).toBe('about');
    expect(next.order).toBe(before.order);
    expect(next.windows.now?.rect).toBe(before.windows.now?.rect);
    expect(next.windows.now).toMatchObject({ minimized: true, transition: { kind: 'minimize', seq: 4 } });
    expect(wmReducer(next, { type: 'MINIMIZE', id: 'now' })).toBe(next);
  });
  it.each(['RESTORE', 'FOCUS'] as const)('%s restores, raises and focuses a minimized window', (type) => {
    const before = wmReducer(three(), { type: 'MINIMIZE', id: 'terminal' });
    const next = wmReducer(before, { type, id: 'terminal' });
    expect(next.windows.terminal).toMatchObject({ minimized: false, transition: { kind: 'restore' } });
    expect(next.focusedId).toBe('terminal');
    expect(next.order.at(-1)).toBe('terminal');
    expect(next.seq).toBe(before.seq + 1);
  });
  it('CLOSE keeps a frame until FINISH_CLOSE and focuses the next eligible window', () => {
    const before = wmReducer(three(), { type: 'MINIMIZE', id: 'about' });
    const closing = wmReducer(before, { type: 'CLOSE', id: 'now' });
    expect(closing.windows.now).toMatchObject({ closing: true, transition: { kind: 'close' } });
    expect(closing.order).toContain('now');
    expect(closing.focusedId).toBe('terminal');
    const done = wmReducer(closing, { type: 'FINISH_CLOSE', id: 'now' });
    expect(done.windows.now).toBeUndefined();
    expect(done.order).toEqual(['terminal', 'about']);
    expect(done.focusedId).toBe('terminal');
    expect(done.history).toBe('none');
  });
  it('closing/minimizing the last visible window gives desktop focus', () => {
    for (const type of ['CLOSE', 'MINIMIZE'] as const) {
      expect(run({ type: 'OPEN', appId: 'terminal' }, { type, id: 'terminal' }).focusedId).toBeNull();
    }
  });
  it('QUIT_APP closes every instance with independent animation sequences', () => {
    const before = run({ type: 'OPEN', appId: 'terminal' }, { type: 'OPEN', appId: 'terminal', newInstance: true }, { type: 'OPEN', appId: 'about' });
    const next = wmReducer(before, { type: 'QUIT_APP', appId: 'terminal' });
    expect(next.windows.terminal?.closing).toBe(true);
    expect(next.windows['terminal~2']?.closing).toBe(true);
    expect(next.windows['terminal~2']?.transition.seq).toBe(next.windows.terminal!.transition.seq + 1);
    expect(next.windows.about).toBe(before.windows.about);
    expect(next.focusedId).toBe('about');
    expect(next.history).toBe('replace');
  });
  it('CLOSE_ALL clears the stash immediately without resetting the sequence or viewport', () => {
    const before = wmReducer(three(), { type: 'SHOW_DESKTOP' });
    const next = wmReducer(before, { type: 'CLOSE_ALL' });
    expect(next).toEqual({ ...before, windows: {}, order: [], focusedId: null, showDesktopStash: null, history: 'replace' });
  });
  it('SHOW_DESKTOP restores only its stash, in order; already-minimized windows stay hidden', () => {
    const before = wmReducer(three(), { type: 'MINIMIZE', id: 'about' });
    const hidden = wmReducer(before, { type: 'SHOW_DESKTOP' });
    expect(hidden.showDesktopStash).toEqual(['terminal', 'now']);
    expect(Object.values(hidden.windows).every((win) => win.minimized)).toBe(true);
    expect(hidden.focusedId).toBeNull();
    const restored = wmReducer(hidden, { type: 'SHOW_DESKTOP' });
    expect(restored.showDesktopStash).toBeNull();
    expect(restored.order).toEqual(['about', 'terminal', 'now']);
    expect(restored.windows.about?.minimized).toBe(true);
    expect(restored.windows.terminal?.minimized).toBe(false);
    expect(restored.focusedId).toBe('now');
  });
  it('SHOW_DESKTOP handles removed/closing stashed windows and empty desktops', () => {
    const hidden = wmReducer(three(), { type: 'SHOW_DESKTOP' });
    const closed = wmReducer(wmReducer(hidden, { type: 'CLOSE', id: 'terminal' }), { type: 'FINISH_CLOSE', id: 'now' });
    const restored = wmReducer(closed, { type: 'SHOW_DESKTOP' });
    expect(restored.focusedId).toBe('about');
    expect(restored.windows.terminal?.closing).toBe(true);
    expect(restored.windows.now).toBeUndefined();
    expect(run({ type: 'SHOW_DESKTOP' }, { type: 'SHOW_DESKTOP' }).showDesktopStash).toBeNull();
  });
});

describe('geometry, navigation and transitions', () => {
  const terminal = () => run({ type: 'OPEN', appId: 'terminal', rect: normal });
  it('MOVE clamps the reachable title bar and remembers normal geometry without an animation', () => {
    const state = wmReducer(terminal(), { type: 'MOVE', id: 'terminal', x: -2000, y: -2000 });
    expect(state.windows.terminal?.rect).toEqual({ ...normal, x: -624, y: 32 });
    expect(state.windows.terminal?.restoreRect).toEqual(state.windows.terminal?.rect);
    expect(state.windows.terminal?.transition.kind).toBe('none');
    expect(state.seq).toBe(1);
  });
  it('MOVE of a snapped frame preserves the last normal rect', () => {
    const state = run({ type: 'OPEN', appId: 'terminal', rect: normal }, { type: 'SNAP', id: 'terminal', zone: 'left' },
      { type: 'MOVE', id: 'terminal', x: 80, y: 90 });
    expect(state.windows.terminal?.restoreRect).toEqual(normal);
    expect(state.windows.terminal?.mode).toBe('snapped');
  });
  it('RESIZE clamps to minimums and returns snapped geometry to normal', () => {
    const state = run({ type: 'OPEN', appId: 'projects' }, { type: 'SNAP', id: 'projects', zone: 'left' },
      { type: 'RESIZE', id: 'projects', rect: { x: 10, y: -10, w: 1, h: 1 } });
    expect(state.windows.projects).toMatchObject({ rect: { x: 10, y: 32, w: 560, h: 400 }, mode: 'normal', snap: null,
      restoreRect: { x: 10, y: 32, w: 560, h: 400 }, transition: { kind: 'none' } });
  });
  it('fixed Settings ignores manual resizing and zooming', () => {
    const state = run({ type: 'OPEN', appId: 'settings' });
    expect(wmReducer(state, { type: 'RESIZE', id: 'settings', rect: normal })).toBe(state);
    expect(wmReducer(state, { type: 'TOGGLE_MAXIMIZE', id: 'settings' })).toBe(state);
  });
  it('non-zoomable Now ignores maximize', () => {
    const state = run({ type: 'OPEN', appId: 'now' });
    expect(wmReducer(state, { type: 'TOGGLE_MAXIMIZE', id: 'now' })).toBe(state);
  });
  it('maximize toggles back to the exact previous normal rect', () => {
    const before = terminal();
    const max = wmReducer(before, { type: 'TOGGLE_MAXIMIZE', id: 'terminal' });
    expect(max.windows.terminal).toMatchObject({ rect: zoneRect('max', before.viewport), mode: 'maximized', snap: 'max', restoreRect: normal,
      transition: { kind: 'zoom', seq: 2 } });
    const restored = wmReducer(max, { type: 'TOGGLE_MAXIMIZE', id: 'terminal' });
    expect(restored.windows.terminal).toMatchObject({ rect: normal, mode: 'normal', snap: null, transition: { kind: 'zoom', seq: 3 } });
    expect(restored.history).toBe('none');
  });
  it('snapping then maximizing never overwrites the normal restore rect', () => {
    const state = run({ type: 'OPEN', appId: 'terminal', rect: normal }, { type: 'SNAP', id: 'terminal', zone: 'left' },
      { type: 'SNAP', id: 'terminal', zone: 'right' }, { type: 'TOGGLE_MAXIMIZE', id: 'terminal' }, { type: 'TOGGLE_MAXIMIZE', id: 'terminal' });
    expect(state.windows.terminal?.rect).toEqual(normal);
  });
  it.each(['left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'max'] as const)
    ('SNAP to %s computes exact geometry and a fresh transition', (zone) => {
      const state = wmReducer(terminal(), { type: 'SNAP', id: 'terminal', zone });
      expect(state.windows.terminal?.rect).toEqual(zoneRect(zone, state.viewport));
      expect(state.windows.terminal?.mode).toBe(zone === 'max' ? 'maximized' : 'snapped');
      expect(state.windows.terminal?.snap).toBe(zone);
      expect(state.windows.terminal?.restoreRect).toEqual(normal);
      expect(state.windows.terminal?.transition).toEqual({ kind: 'snap', seq: 2, origin: null });
    });
  it('SNAP rejects a zone below either app minimum without changing anything', () => {
    const state = wmReducer(run({ type: 'OPEN', appId: 'projects' }), { type: 'VIEWPORT', viewport: { w: 1024, h: 640 } });
    expect(wmReducer(state, { type: 'SNAP', id: 'projects', zone: 'left' })).toBe(state);
    expect(wmReducer(state, { type: 'SNAP', id: 'projects', zone: 'top-left' })).toBe(state);
  });
  it('SNAP accepts a zone exactly at the minimum', () => {
    const state = wmReducer(terminal(), { type: 'VIEWPORT', viewport: { w: 864, h: 392 } });
    expect(wmReducer(state, { type: 'SNAP', id: 'terminal', zone: 'left' }).windows.terminal?.rect).toEqual({ x: 8, y: 40, w: 420, h: 268 });
  });
  it('UNSNAP restores dimensions under the pointer at the original relative horizontal position', () => {
    const state = run({ type: 'OPEN', appId: 'terminal', rect: normal }, { type: 'SNAP', id: 'terminal', zone: 'left' },
      { type: 'UNSNAP', id: 'terminal', pointer: { x: 362, y: 200 } });
    expect(state.windows.terminal).toMatchObject({ rect: { x: 2, y: 180, w: 720, h: 440 }, mode: 'normal', snap: null,
      transition: { kind: 'unsnap', seq: 3 } });
    expect(state.windows.terminal?.restoreRect).toEqual(state.windows.terminal?.rect);
  });
  it('UNSNAP clamps to the menu bar and ignores normal windows', () => {
    expect(wmReducer(terminal(), { type: 'UNSNAP', id: 'terminal', pointer: { x: 10, y: 10 } })).toEqual(terminal());
    const state = run({ type: 'OPEN', appId: 'terminal', rect: normal }, { type: 'SNAP', id: 'terminal', zone: 'left' },
      { type: 'UNSNAP', id: 'terminal', pointer: { x: 8, y: 0 } });
    expect(state.windows.terminal?.rect.y).toBe(32);
  });
  it('NAVIGATE replaces query, optionally updates title, and defaults to push', () => {
    const state = run({ type: 'OPEN', appId: 'projects', query: { shot: '1' } },
      { type: 'NAVIGATE', id: 'projects', route: 'salli', title: 'Salli — Projects' });
    expect(state.windows.projects).toMatchObject({ route: 'salli', query: {}, title: 'Salli — Projects' });
    expect(state.history).toBe('push');
    expect(state.seq).toBe(1);
    expect(wmReducer(state, { type: 'NAVIGATE', id: 'projects', route: '', history: 'replace' }).history).toBe('replace');
    expect(wmReducer(state, { type: 'NAVIGATE', id: 'projects', route: 'a/b' })).toBe(state);
  });
  it('SET_QUERY and SET_TITLE preserve the other app fields and do not animate', () => {
    const before = terminal();
    const next = wmReducer(before, { type: 'SET_QUERY', id: 'terminal', query: { cmd: 'help' } });
    expect(next.history).toBe('replace');
    expect(next.windows.terminal?.query).toEqual({ cmd: 'help' });
    expect(next.windows.terminal?.route).toBe('');
    expect(wmReducer(next, { type: 'SET_QUERY', id: 'terminal', query: {}, history: 'push' }).history).toBe('push');
    const title = wmReducer(next, { type: 'SET_TITLE', id: 'terminal', title: 'Terminal · help' });
    expect(title.windows.terminal?.title).toBe('Terminal · help');
    expect(title.windows.terminal?.query).toEqual({ cmd: 'help' });
    expect(title.history).toBe('none');
    expect(title.seq).toBe(before.seq);
  });
  it('VIEWPORT reclamps normal windows and recomputes all snapped/maximized zones', () => {
    const before = run({ type: 'OPEN', appId: 'terminal', rect: { x: 1400, y: 850, w: 2000, h: 1000 } },
      { type: 'OPEN', appId: 'projects' }, { type: 'SNAP', id: 'projects', zone: 'right' },
      { type: 'OPEN', appId: 'writing' }, { type: 'TOGGLE_MAXIMIZE', id: 'writing' });
    const next = wmReducer(before, { type: 'VIEWPORT', viewport: { w: 1024, h: 640 } });
    expect(next.windows.terminal?.rect).toEqual({ x: 928, y: 600, w: 1008, h: 516 });
    expect(next.windows.terminal?.restoreRect).toEqual(next.windows.terminal?.rect);
    expect(next.windows.projects?.rect).toEqual({ x: 516, y: 40, w: 500, h: 516 });
    expect(next.windows.writing?.rect).toEqual({ x: 8, y: 40, w: 1008, h: 516 });
    expect(next.windows.projects?.restoreRect).toEqual(before.windows.projects?.restoreRect);
    expect(next.seq).toBe(before.seq);
    expect(next.history).toBe('none');
  });
});

describe('URL state reconciliation and pure boundaries', () => {
  const target = (url: string) => parseLocation(new URL(url, 'https://os.nipuntheekshana.com'));
  it('SYNC_FROM_URL immediately removes visible missing apps but keeps minimized ones', () => {
    const before = wmReducer(three(), { type: 'MINIMIZE', id: 'about' });
    const next = wmReducer(before, { type: 'SYNC_FROM_URL', target: target('/projects/salli?w=terminal') });
    expect(next.order).toEqual(['about', 'terminal', 'projects']);
    expect(next.windows.about).toBe(before.windows.about);
    expect(next.windows.terminal).toBe(before.windows.terminal);
    expect(next.windows.now).toBeUndefined();
    expect(next.windows.projects).toMatchObject({ route: 'salli', transition: { origin: null } });
    expect(next.focusedId).toBe('projects');
    expect(next.history).toBe('none');
  });
  it('SYNC_FROM_URL navigates/restores reused windows without changing identity', () => {
    const before = run({ type: 'OPEN', appId: 'projects', route: 'mochi' }, { type: 'MINIMIZE', id: 'projects' });
    const next = wmReducer(before, { type: 'SYNC_FROM_URL', target: target('/projects/salli?shot=2') });
    expect(next.order).toEqual(['projects']);
    expect(next.windows.projects).toMatchObject({ route: 'salli', query: { shot: '2' }, minimized: false, title: 'Projects' });
    expect(next.windows.projects?.createdSeq).toBe(before.windows.projects?.createdSeq);
    expect(next.focusedId).toBe('projects');
  });
  it('SYNC_FROM_URL creates/reuses separate Terminal instances and removes excess visible ones', () => {
    let state = wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target: target('/terminal?w=terminal,terminal&cmd=help') });
    expect(state.order).toEqual(['terminal', 'terminal~2', 'terminal~3']);
    expect(state.focusedId).toBe('terminal~3');
    expect(state.windows['terminal~3']?.query).toEqual({ cmd: 'help' });
    const before = state;
    state = wmReducer(state, { type: 'SYNC_FROM_URL', target: target('/terminal?w=terminal,terminal&cmd=help') });
    expect(state.windows).toEqual(before.windows);
    expect(state.seq).toBe(before.seq);
    state = wmReducer(state, { type: 'SYNC_FROM_URL', target: target('/terminal?cmd=help') });
    expect(state.order).toEqual(['terminal~3']);
    expect(state.windows['terminal~3']).toBe(before.windows['terminal~3']);
  });
  it('SYNC_FROM_URL home keeps hidden windows, clears focus, and drops visible frames immediately', () => {
    const before = run({ type: 'OPEN', appId: 'terminal' }, { type: 'MINIMIZE', id: 'terminal' }, { type: 'OPEN', appId: 'now' });
    const next = wmReducer(before, { type: 'SYNC_FROM_URL', target: target('/') });
    expect(next.order).toEqual(['terminal']);
    expect(next.windows.now).toBeUndefined();
    expect(next.focusedId).toBeNull();
    expect(next.history).toBe('none');
  });
  it('SYNC_FROM_URL gates even targets supplied directly by a caller', () => {
    const next = wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target: {
      focused: { appId: 'guestbook', route: '', query: {} }, others: [], unknownPath: false,
    } });
    expect(next.order).toEqual([]);
    expect(next.focusedId).toBeNull();
  });
  const idActions: WMAction[] = [
    { type: 'CLOSE', id: 'missing' }, { type: 'FOCUS', id: 'missing' }, { type: 'MOVE', id: 'missing', x: 1, y: 2 },
    { type: 'RESIZE', id: 'missing', rect: normal }, { type: 'MINIMIZE', id: 'missing' }, { type: 'RESTORE', id: 'missing' },
    { type: 'TOGGLE_MAXIMIZE', id: 'missing' }, { type: 'SNAP', id: 'missing', zone: 'max' },
    { type: 'UNSNAP', id: 'missing', pointer: { x: 0, y: 0 } }, { type: 'NAVIGATE', id: 'missing', route: '' },
    { type: 'SET_QUERY', id: 'missing', query: {} }, { type: 'SET_TITLE', id: 'missing', title: 'x' },
  ];
  it.each(idActions)('ignores missing ids for $type', (action) => {
    const before = three();
    expect(wmReducer(before, action)).toBe(before);
  });
  it.each(idActions)('ignores $type on a closing frame', (action) => {
    const before = wmReducer(three(), { type: 'CLOSE', id: 'now' });
    expect(wmReducer(before, { ...action, id: 'now' } as WMAction)).toBe(before);
  });
  it('does not mutate frozen inputs and retains unaffected window references', () => {
    const before = freeze(three());
    const action = freeze({ type: 'OPEN', appId: 'projects', query: { shot: '2' }, rect: normal, origin: { x: 1, y: 2 } } as const);
    const next = wmReducer(before, action);
    expect(next.windows.terminal).toBe(before.windows.terminal);
    expect(next.windows.projects?.query).not.toBe(action.query);
    expect(next.windows.projects?.rect).not.toBe(action.rect);
    expect(next.windows.projects?.transition.origin).not.toBe(action.origin);
    expect(wmReducer(freeze(next), freeze({ type: 'SHOW_DESKTOP' } as const)).focusedId).toBeNull();
  });
  it('retains window references when title, query, normal geometry or viewport do not change', () => {
    const before = run({ type: 'OPEN', appId: 'terminal', rect: normal }, { type: 'MOVE', id: 'terminal', x: normal.x, y: normal.y });
    for (const action of [
      { type: 'SET_TITLE', id: 'terminal', title: 'Terminal' }, { type: 'SET_QUERY', id: 'terminal', query: {} },
      { type: 'MOVE', id: 'terminal', x: normal.x, y: normal.y }, { type: 'RESIZE', id: 'terminal', rect: normal },
      { type: 'VIEWPORT', viewport: before.viewport },
    ] as WMAction[]) {
      expect(wmReducer(before, action).windows.terminal).toBe(before.windows.terminal);
    }
  });
  it('keeps every core module free of React, DOM packages and environment imports', () => {
    for (const path of ['wm/types.ts', 'wm/reducer.ts', 'wm/geometry.ts', 'wm/placement.ts', 'url/url.ts', 'url/history.ts', 'lib/hotkeys-match.ts']) {
      const source = readFileSync(new URL(`../../src/os/${path}`, import.meta.url), 'utf8');
      const imports = [...source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)].map((match) => match[1]!);
      expect(imports.filter((name) => !name.startsWith('.')), path).toEqual([]);
      expect(source, path).not.toMatch(/\b(?:globalThis|localStorage|Date\.now|Math\.random|document\.querySelector)\b/);
    }
  });
});
