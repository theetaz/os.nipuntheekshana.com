import { COMMANDS, tokenize } from './shell';
import { APP_ALIASES, APP_TARGETS } from './commands/open';
import { ACCENTS } from './commands/system';
import { WALLPAPERS } from '../../state/prefs';
import { listDirectory, resolvePath, type Vfs } from './vfs';

export interface Completion { value: string; cursor: number; candidates: string[] }
export function complete(source: string, cursor: number, cwd: string, vfs?: Vfs): Completion {
  const original = { value: source, cursor, candidates: [] as string[] };
  let tokens;
  try { tokens = tokenize(source.slice(0, cursor), true); } catch { return original; }
  const lastAnd = tokens.findLastIndex(token => token.kind === 'and');
  tokens = tokens.slice(lastAnd + 1);
  const last = tokens.at(-1); const editing = last?.kind === 'word' && last.end === cursor;
  const token = editing ? last : undefined; const prefix = token?.value ?? '';
  const index = tokens.length - (editing ? 1 : 0); const command = tokens[0]?.value ?? '';
  let candidates: string[] = [];
  if (index === 0 || command === 'help') candidates = Object.keys(COMMANDS);
  else if (command === 'theme') candidates = ['light', 'dark', 'auto'];
  else if (command === 'accent') candidates = ['list', ...ACCENTS];
  else if (command === 'wallpaper') candidates = ['list', ...WALLPAPERS];
  else if (command === 'sound') candidates = ['on', 'off'];
  else if (command === 'make') candidates = ['tea'];
  else if (command === 'mochi' && index === 1) candidates = ['pet', 'sleep', 'wake', 'say', 'hide', 'show'];
  else if (command === 'projects') {
    const previous = tokens[index - 1]?.value;
    candidates = previous === '--category' ? ['data', 'apps', 'hardware', 'worlds', 'ai']
      : previous === '--status' ? ['active', 'incubating'] : ['--category', '--status'];
  } else if (['cd', 'ls', 'cat', 'open'].includes(command)) {
    if (vfs) {
      const slash = prefix.lastIndexOf('/'); const parent = prefix.slice(0, slash + 1);
      const dir = resolvePath(parent || '.', cwd);
      if (vfs.get(dir)?.kind === 'directory') candidates = listDirectory(vfs, dir, prefix.slice(slash + 1).startsWith('.'))
        .filter(entry => command !== 'cd' || entry.kind === 'directory')
        .map(entry => parent + (command === 'open' && entry.target && /^\/(projects|writing)\//.test(entry.target)
          ? entry.name.replace(/\.md$/, '') : entry.name) + (entry.kind === 'directory' ? '/' : ''));
      if (command === 'open') candidates.push(...[...vfs.values()].flatMap(entry => entry.target && /^\/(projects|writing)\//.test(entry.target) ? [entry.target.slice(1)] : []));
    }
    if (command === 'open') candidates.push(...APP_TARGETS.map(app => app.id), ...Object.keys(APP_ALIASES), 'github', 'linkedin', 'prabhava');
  }
  candidates = [...new Set(candidates.filter(candidate => candidate.startsWith(prefix)))].sort();
  if (!candidates.length) return original;
  let replacement = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    while (!candidate.startsWith(replacement)) replacement = replacement.slice(0, -1);
  }
  if (replacement === prefix && candidates.length > 1) return { ...original, candidates };
  const quoted = source[token?.start ?? cursor] === '"' || source[token?.start ?? cursor] === "'";
  const quote = quoted ? source[token!.start]! : '';
  let encoded = quote ? quote + replacement + (candidates.length === 1 && !replacement.endsWith('/') ? quote : '')
    : replacement.replace(/[\s'"\\;&|<>]/g, char => '\\' + char);
  const start = token?.start ?? cursor;
  let end = cursor;
  try { end = tokenize(source, true).find(part => part.kind === 'word' && part.start === start)?.end ?? cursor; } catch { /* Keep unrelated syntax untouched. */ }
  if (candidates.length === 1 && !replacement.endsWith('/') && !/^\s/.test(source.slice(end))) encoded += ' ';
  return { value: source.slice(0, start) + encoded + source.slice(end), cursor: start + encoded.length, candidates };
}
