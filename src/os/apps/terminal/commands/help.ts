import type { CommandHandler } from '../types';
import { failure, success } from '../types';

export const HELP = [
  'Explore: ls, cd, pwd, cat, open, projects, writing, now, cv, contact',
  'System: theme, wallpaper, accent, sound, date, clear, history, exit, neofetch',
  'Fun: mochi, pin, tea, sleep',
  'Also: whoami, socials, echo, make tea, sudo, rm, vim, nano, emacs, ssh, ayubowan',
  'help <cmd> prints usage and an example. Join commands with &&.',
].join('\n');
export const USAGE: Record<string, [string, string]> = {
  help: ['help [cmd]', 'help cat'], whoami: ['whoami', 'whoami'],
  ls: ['ls [-a] [path]', 'ls -a ~'], cd: ['cd [dir]', 'cd projects && ls'], pwd: ['pwd', 'pwd'],
  cat: ['cat <file>', 'cat now.txt'], open: ['open <target>', 'open projects/salli'],
  projects: ['projects [--category <data|apps|hardware|worlds|ai>] [--status <active|incubating>]', 'projects --category data'],
  writing: ['writing', 'writing'], now: ['now', 'now'], cv: ['cv', 'cv'], contact: ['contact', 'contact'],
  socials: ['socials', 'socials'], neofetch: ['neofetch', 'neofetch'], date: ['date', 'date'],
  theme: ['theme [light|dark|auto]', 'theme dark'], wallpaper: ['wallpaper [list|<id>]', 'wallpaper contours'],
  accent: ['accent [list|<name>]', 'accent lagoon'], sound: ['sound [on|off]', 'sound on'],
  mochi: ['mochi [pet|sleep|wake|say <text>|hide|show]', 'mochi say "Hello, Mochi"'],
  pin: ['pin', 'pin'], sleep: ['sleep', 'sleep'], history: ['history', 'history'], echo: ['echo <text>', 'echo "Ceylon tea"'],
  clear: ['clear', 'clear'], exit: ['exit', 'exit'], tea: ['tea', 'tea'], make: ['make tea', 'make tea'],
  sudo: ['sudo <anything>', 'sudo make tea'], rm: ['rm <file>', 'rm now.txt'],
  vim: ['vim [file]', 'vim about.md'], nano: ['nano [file]', 'nano about.md'], emacs: ['emacs [file]', 'emacs about.md'],
  ssh: ['ssh <host>', 'ssh serendib'], ayubowan: ['ayubowan', 'ayubowan'],
};
export const help: CommandHandler = args => {
  if (!args.length) return success(HELP);
  const usage = args.length === 1 ? USAGE[args[0]!] : undefined;
  return usage ? success(`Usage: ${usage[0]}\nExample: ${usage[1]}`) : failure(`help: unknown command: ${args.join(' ')}`);
};
export const usageError = (name: string) => failure(`Usage: ${USAGE[name]?.[0] ?? name}`);
