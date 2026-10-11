import { describe, expect, it } from 'vitest';
import { GLOBAL_SHORTCUTS, formatShortcut } from '../../src/os/lib/hotkeys-match';
import { shortcutRows } from '../../src/os/apps/readme/shortcuts';
import { parseLocation, queryFor, serializeLocation, windowLink } from '../../src/os/url/url';
import { subscribeHistory } from '../../src/os/url/history';
import { wmReducer } from '../../src/os/wm/reducer';
import { createDesktopState } from '../../src/os/wm/types';

describe('P3-5 Read me links and shortcuts', () => {
  it.each(['welcome', 'getting-around', 'shortcuts', 'plain-page', 'privacy', 'credits'])('round-trips and shares section %s', section => {
    const url = new URL(`https://os.nipuntheekshana.com/readme?section=${section}`);
    const target = parseLocation(url);
    expect(target.focused?.query).toEqual({ section });
    const state = wmReducer(createDesktopState(), { type: 'SYNC_FROM_URL', target });
    expect(serializeLocation(state)).toBe(url.pathname + url.search);
    expect(windowLink(state.windows.readme!)).toBe(url.href);
  });
  it('preserves section with legacy open links and takes the first duplicate value', () => {
    expect(parseLocation(new URL('https://os.nipuntheekshana.com/?open=readme&section=shortcuts&section=credits')).focused)
      .toEqual({ appId: 'readme', route: '', query: { section: 'shortcuts' } });
  });
  it.each(['', 'unknown', 'Shortcuts', 'shortcuts\n', '<script>', 'privacy/credits'])('rejects unknown section %j', section => {
    expect(queryFor('readme', { section })).toEqual({});
  });
  it('keeps section owned by Read me and drops other query keys', () => {
    expect(queryFor('readme', { section: 'shortcuts', cmd: 'help', shot: '0' })).toEqual({ section: 'shortcuts' });
    expect(queryFor('now', { section: 'shortcuts' })).toEqual({});
    expect(queryFor('settings', { section: 'shortcuts' })).toEqual({});
  });
  it('syncs a section-only URL at startup before another action can overwrite it', () => {
    let state = wmReducer(createDesktopState(), { type: 'OPEN', appId: 'readme', adopted: true });
    const port = {
      location: { href: 'https://os.nipuntheekshana.com/readme?section=shortcuts', pathname: '/readme', search: '?section=shortcuts', hash: '' },
      document: { title: '' }, addEventListener() {}, removeEventListener() {},
    };
    const cleanup = subscribeHistory({ getState: () => state,
      dispatch: action => { state = wmReducer(state, action); }, subscribe: () => () => {},
    }, port, { state: null, pushState() {}, replaceState() {} });
    expect(state.windows.readme?.query).toEqual({ section: 'shortcuts' }); cleanup();
  });
  it.each(['mac', 'windows', 'linux', 'other'] as const)('generates every global shortcut with %s labels', platform => {
    const rows = shortcutRows(platform);
    expect(rows).toHaveLength(GLOBAL_SHORTCUTS.length);
    rows.forEach((row, index) => {
      expect(row.keys).toBe(formatShortcut(GLOBAL_SHORTCUTS[index]!.shortcut, platform));
      expect(row.action).not.toContain('.');
    });
  });
});
