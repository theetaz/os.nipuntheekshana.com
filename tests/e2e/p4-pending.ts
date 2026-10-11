import type { TestInfo } from '@playwright/test';

const menus = 'P4-1/P4-3: adapt desktop menu/status interactions to the phone shell and per-app phone commands.';
const sheets = 'P4-2: implement phone sheet navigation/gestures and adapt desktop window interactions.';
const home = 'P4-1: implement the phone home launcher, widgets and companion; desktop controls are absent.';

/** Only tests that require an explicitly unfinished phone-shell capability. */
export function pendingPhoneCapability(info: TestInfo): string | undefined {
  if (!info.project.name.startsWith('mobile')) return;
  const file = info.file.split('/').at(-1);
  const title = info.title;
  if (file === 'mochi.spec.ts') return home;
  if (file === 'menus.spec.ts') return menus;
  if (file === 'window-ops.spec.ts' && !/^(loading skeleton|a prevented preload|a runtime app exception)/.test(title)) return sheets;
  if (file === 'boot.spec.ts' && info.titlePath.includes('integrated power commands') && !title.startsWith('never sleeps automatically')) return menus;
  const cases: Record<string, [RegExp, string][]> = {
    'about.spec.ts': [[/^per-window View and File menus/, menus]],
    'adoption.spec.ts': [[/^adoption never steals focus outside/, sheets]],
    'css-scoping.spec.ts': [[/^(About|CV|Island|Activity|Settings|Kooda|Read me) awaits cold CSS/, home]],
    'dock.spec.ts': [[/^(resting dock exactly replaces|single-window clicks minimise)/, home]],
    'island.spec.ts': [[/^(a deep link with another app opens two managed windows|failed adoption leaves|adopted routes can enter Simple view)/, sheets]],
    'projects.spec.ts': [[/^context menu routes project actions; View menus/, menus], [/^(Salli detail facts|keyboard grid arrows)/, 'P4-3: adapt desktop click-selection/double-click and keyboard grid flows to the phone single-tap tiles.'], [/^\/projects adopts identical content geometry/, 'P4-2/P4-3: reconcile phone Projects toolbar geometry during sheet adoption.']],
    'writing.spec.ts': [[/^View commands, shortcuts/, menus], [/^(Engineering has one post|folders, tags and search|post data failures can retry)/, 'P4-3: provide phone Writing folders and article/list navigation; desktop sidebars are hidden.']],
    'static-desktop.spec.ts': [[/^stored Simple view can return/, menus]],
    'messages.spec.ts': [[/^registered app menus/, menus], [/^(Mochi pet count reaches|closing guards drafts)/, home], [/^thread search, composer bounds/, 'P4-3: provide the phone conversation search controls; desktop sidebar search is hidden.']],
    'now-readme.spec.ts': [[/^(Now opens from Go|Help opens Read me|section links, View commands|the plain page link works|(?:now|readme) retries a failed)/, menus], [/^(now|readme) adopts the static content/, 'P4-2: reconcile the phone sheet header height during adoption (52px static versus 40px managed).']],
    'settings.spec.ts': [
      [/^(Reduce motion stops live dock|wallpapers apply live|Desktop resets remove)/, home],
      [/^desktop context query/, menus],
    ],
    'cv.spec.ts': [
      [/^(CV has two fixed pages|zoom uses|Fit follows|thumbnails and scrolling|page tracking reflects|print media hides)/, 'P4-3: adapt desktop CV zoom/thumbnails controls to the phone viewer; dedicated phone/print-layout checks remain active.'],
      [/^View menu and keyboard/, menus],
      [/^adoption preserves CV geometry/, 'P4-2: reconcile the phone sheet header height during CV adoption (52px static versus 40px managed).'],
    ],
    'terminal.spec.ts': [
      [/^keyboard shortcuts, text-size limits, menu commands/, menus],
      [/^OS preferences, screensaver and duplicate sessions/, sheets],
      [/^(open projects\/salli and output links|a loading app owns focus)/, 'P4-2: implement the phone app switcher to return to Terminal after opening another app.'],
    ],
    'kooda.spec.ts': [[/^File menu owns Empty Kooda/, menus], [/^Empty Kooda confirms, cancels, updates dock/, home]],
    'maps.spec.ts': [[/^live wallpaper is lazy/, home], [/^minimisation and hidden documents/, sheets], [/^layers and menus work/, menus]],
    'p2-10-sound.spec.ts': [[/^menu opening ticks/, menus], [/^persisted sound and a synthetic launch/, home]],
    'quicklook.spec.ts': [[/^selecting a Projects tile and pressing Space/, 'P4-3: adapt desktop tile selection to phone single-tap navigation; dedicated phone Quick Look checks remain active.']],
    'spotlight.spec.ts': [[/^no-results copy, combobox/, menus]],
  };
  return cases[file ?? '']?.find(([pattern]) => pattern.test(title))?.[1];
}
