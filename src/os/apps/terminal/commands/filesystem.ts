import { buildVfs, HOME, listDirectory, resolvePath } from '../vfs';
import { failure, segment, success, type CommandHandler } from '../types';
import { usageError } from './help';

export const filesystem: Record<string, CommandHandler> = {
  pwd: (args, context) => args.length ? usageError('pwd') : success(context.cwd),
  cd: async (args, context) => {
    if (args.length > 1) return usageError('cd');
    const path = resolvePath(args[0] ?? HOME, context.cwd);
    const entry = buildVfs(await context.data()).get(path);
    if (!entry) return failure(`cd: ${args[0]}: No such file or directory`);
    if (entry.kind !== 'directory') return failure(`cd: ${args[0]}: Not a directory`);
    context.cwd = path; return success();
  },
  ls: async (args, context) => {
    let hidden = false; const paths: string[] = []; let flags = true;
    for (const arg of args) {
      if (flags && arg === '--') { flags = false; continue; }
      if (flags && arg === '-a') hidden = true;
      else if (flags && arg.startsWith('-')) return usageError('ls');
      else paths.push(arg);
    }
    if (paths.length > 1) return usageError('ls');
    const input = paths[0] ?? '.'; const vfs = buildVfs(await context.data());
    const entry = vfs.get(resolvePath(input, context.cwd));
    if (!entry) return failure(`ls: ${input}: No such file or directory`);
    const entries = entry.kind === 'directory' ? listDirectory(vfs, entry.path, hidden) : [entry];
    const names = entries.map(file => file.name + (file.kind === 'directory' ? '/' : ''));
    const cell = Math.max(1, ...names.map(name => name.length)) + 2;
    const columns = Math.max(1, Math.floor(context.columns / cell));
    const lines = [];
    for (let i = 0; i < entries.length; i += columns) {
      lines.push(entries.slice(i, i + columns).map((file, index) => segment(
        names[i + index]!.padEnd(index === Math.min(columns, entries.length - i) - 1 ? names[i + index]!.length : cell),
        file.kind === 'directory' ? 'path' : 'ink')));
    }
    return { ok: true, lines };
  },
  cat: async (args, context) => {
    if (args.length !== 1) return usageError('cat');
    const input = args[0]!; const entry = buildVfs(await context.data()).get(resolvePath(input, context.cwd));
    if (!entry) return failure(`cat: ${input}: No such file or directory`);
    if (entry.kind === 'directory') return failure(`cat: ${input}: Is a directory`);
    if (entry.kind === 'binary') return failure(`cat: ${input}: binary file. Try: open cv`);
    return { ok: true, lines: entry.lines };
  },
};
