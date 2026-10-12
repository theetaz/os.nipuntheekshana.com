import type { TestInfo } from '@playwright/test';

/** Remaining per-app phone work belongs to P4-3. */
export function pendingPhoneCapability(info: TestInfo): string | undefined {
  if (!info.project.name.startsWith('mobile')) return;
  const file = info.file.split('/').at(-1);
  const cases: Record<string, [RegExp, string][]> = {
    'writing.spec.ts': [[/^(Engineering has one post|folders, tags and search|post data failures can retry)/, 'P4-3: provide phone Writing folders and article/list navigation.']],
    'messages.spec.ts': [[/^thread search, composer bounds/, 'P4-3: provide phone conversation search controls.']],
  };
  return cases[file ?? '']?.find(([pattern]) => pattern.test(info.title))?.[1];
}

/** Desktop spatial controls have no phone equivalent; phone contracts have dedicated coverage. */
export function desktopOnlyCapability(info: TestInfo): boolean {
  if (!info.project.name.startsWith('mobile')) return false;
  const file=info.file.split('/').at(-1);const title=info.title;
  if (file==='eggs.spec.ts') return !/^(effects remain lazy|Developer fits)/.test(title);
  if (['desktop.spec.ts','dock.spec.ts','mochi.spec.ts'].includes(file??'')) return true;
  if (file==='window-ops.spec.ts') return !/^(Tab wraps|window containment|loading skeleton|a prevented preload|a runtime app exception)/.test(title);
  if (file==='menus.spec.ts') return !/^View checks/.test(title);
  if (file==='boot.spec.ts'&&info.titlePath.includes('integrated power commands')) return !title.startsWith('never sleeps automatically');
  const cases:Record<string,RegExp>={
    'activity.spec.ts': /^rendering pauses on minimise/,
    'settings.spec.ts': /^(Reduce motion stops live dock|wallpapers apply live|Desktop resets remove|desktop context query)/,
    'island.spec.ts': /^(a deep link with another app opens two managed windows|failed adoption leaves)/,
    'maps.spec.ts': /^(live wallpaper is lazy|minimisation and hidden documents)/,
    'p2-10-sound.spec.ts': /^(menu opening ticks|persisted sound and a synthetic launch)/,
    'terminal.spec.ts': /^OS preferences, screensaver and duplicate sessions/,
    'kooda.spec.ts': /^Empty Kooda confirms, cancels, updates dock/,
  };
  return cases[file??'']?.test(title)??false;
}
