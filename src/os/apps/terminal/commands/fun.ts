import { TEA } from '../ascii';
import { failure, success, type CommandHandler } from '../types';
import { usageError } from './help';

const tea: CommandHandler = args => args.length ? usageError('tea') : success([...TEA, 'Ceylon tea. Strong, no sugar. Brewing… done.'].join('\n'));
const editor: CommandHandler = () => failure('No editors here. This file system is read-only, like a good archive.');
export const fun: Record<string, CommandHandler> = {
  tea, make: (args, context) => args.length === 1 && args[0] === 'tea' ? tea([], context) : usageError('make'),
  echo: args => success(args.join(' ')),
  sudo: (_args, context) => { context.mochi.setMood('surprised'); return failure('nipun is not in the sudoers file. This incident will be reported to Mochi.'); },
  rm: () => failure('rm: read-only file system. Everything here is open source anyway: github.com/theetaz'),
  vim: editor, nano: editor, emacs: editor,
  ssh: () => failure('ssh: connect to host: connection refused. Try contact instead.'),
  ayubowan: (args, context) => {
    if (args.length) return usageError('ayubowan');
    context.mochi.wave(); return success('ආයුබෝවන්. (Sinhala: "may you live long" — the everyday greeting.)');
  },
  pin: (args, context) => {
    if (args.length) return usageError('pin'); context.open('maps', { route: 'play' }); return success('Opening Pin the city.');
  },
  sleep: (args, context) => {
    if (args.length) return usageError('sleep'); context.run('os.sleep'); return success();
  },
  mochi: (args, context) => {
    if (!args.length) { const mochi = context.mochi.getState(); return success(`Mochi: ${mochi.mood}. ${mochi.pets} pets.`); }
    const action = args[0]!;
    if (action === 'say' && args.length > 1) { context.mochi.say(args.slice(1).join(' ').slice(0, 80)); return success(); }
    if (args.length !== 1 || !['pet', 'sleep', 'wake', 'hide', 'show'].includes(action)) return usageError('mochi');
    context.mochi[action as 'pet' | 'sleep' | 'wake' | 'hide' | 'show'](); return success();
  },
};
