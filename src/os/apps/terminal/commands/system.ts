import { CODENAME, VERSION } from '../../../config';
import { formatColombo } from '../../../lib/colombo-time';
import { WALLPAPERS } from '../../../state/prefs';
import { ISLAND } from '../ascii';
import { segment, success, type CommandHandler, type Line } from '../types';
import { usageError } from './help';

export const ACCENTS = ['thambili', 'lagoon', 'lotus', 'tea'] as const;
export const wallpaperName = (id: string) => id === 'galle-face' ? 'Galle Face' : id === 'island-live' ? 'Island live' : id[0]!.toUpperCase() + id.slice(1);
export function dateText(date: Date): string {
  const day = formatColombo(date, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replaceAll(',', '');
  const time = formatColombo(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return `${day}, ${time} in Colombo (UTC+05:30) · ${local} where you are`;
}
export function loginText(date: Date, instance = 1): string {
  return `Last login: ${formatColombo(date, { weekday: 'short', day: '2-digit', month: 'short' }).replaceAll(',', '')} ${formatColombo(date, {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })} on ttys${String(instance).padStart(3, '0')} (Colombo time)`;
}
export const system: Record<string, CommandHandler> = {
  theme: (args, context) => {
    if (args.length > 1 || args[0] && !['light', 'dark', 'auto'].includes(args[0])) return usageError('theme');
    if (args[0]) context.run(`theme.${args[0]}`);
    return success(args[0] ?? context.system().appearance);
  },
  wallpaper: (args, context) => {
    if (args.length > 1 || args[0] && args[0] !== 'list' && !WALLPAPERS.includes(args[0] as typeof WALLPAPERS[number])) return usageError('wallpaper');
    if (args[0] === 'list') return success(WALLPAPERS.map(id => `${id} — ${wallpaperName(id)}`).join('\n'));
    if (args[0]) context.run(`wallpaper.${args[0]}`);
    return success(args[0] ?? context.system().wallpaper);
  },
  accent: (args, context) => {
    if (args.length > 1 || args[0] && args[0] !== 'list' && !ACCENTS.includes(args[0] as typeof ACCENTS[number])) return usageError('accent');
    if (args[0] === 'list') return success(ACCENTS.join('\n'));
    if (args[0]) context.run(`accent.${args[0]}`);
    return success(args[0] ?? context.system().accent);
  },
  sound: (args, context) => {
    if (args.length > 1 || args[0] && !['on', 'off'].includes(args[0])) return usageError('sound');
    const current = context.system().sound;
    if (!args[0] || (args[0] === 'on') !== current) context.run('os.sound');
    return success(args[0] ?? (current ? 'off' : 'on'));
  },
  date: (args, context) => args.length ? usageError('date') : success(dateText(context.now())),
  history: (args, context) => args.length ? usageError('history') : success(context.history.map((line, i) => `${String(i + 1).padStart(3)}  ${line}`).join('\n')),
  clear: args => args.length ? usageError('clear') : { ok: true, lines: [], clear: true },
  exit: (args, context) => {
    if (args.length) return usageError('exit');
    context.close(); return { ok: true, lines: [], exit: true };
  },
  neofetch: async (args, context) => {
    if (args.length) return usageError('neofetch');
    const data = await context.data();
    const activity = await context.activity().catch(() => null);
    const sys = context.system(); const site = data.profile.site;
    const years = Math.max(0, context.now().getFullYear() - site.careerStart);
    const info: [string, string][] = [
      ['OS', `Serendib ${VERSION} "${CODENAME}"`], ['Host', 'os.nipuntheekshana.com'], ['Kernel', sys.kernel],
      ['Uptime', `${years} years (shipping since ${site.careerStart})`], ['Packages', `${data.projects.length} projects, ${data.posts.length} posts`],
      ['Shell', 'nsh 1.0'], ['Location', `${site.location.split(',')[0]} · ${Math.abs(site.coordinates.lat).toFixed(4)}°${site.coordinates.lat < 0 ? 'S' : 'N'} ${Math.abs(site.coordinates.lon).toFixed(4)}°${site.coordinates.lon < 0 ? 'W' : 'E'}`],
      ['Theme', `${wallpaperName(sys.wallpaper)} (${sys.theme}), accent ${wallpaperName(sys.accent)}`],
      ['Contrib.', activity?.available ? `${activity.total.toLocaleString('en-GB')} GitHub contributions this year` : 'GitHub contributions unavailable'],
    ];
    const right: Line[] = [[segment('nipun', 'user'), segment('@', 'dim'), segment('serendib', 'host')], [segment('──────────────', 'dim')],
      ...info.map(([label, value]) => [segment(label.padEnd(10), 'user'), segment(value)]),
      ['dim', 'err', 'ok', 'host', 'link', 'path', 'user', 'ink'].map(tone => segment('■ ', tone as 'ink'))];
    return { ok: true, lines: ISLAND.map((art, i) => [segment(art.padEnd(16), 'host'), ...right[i]!]) };
  },
};
