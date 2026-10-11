import { APP_META } from '../../../registry/meta';
import type { AppId } from '../../../types/apps';
import { matchRoute } from '../../../url/routes';
import { buildVfs, resolvePath } from '../vfs';
import { failure, segment, type CommandHandler } from '../types';
import { usageError } from './help';

export const APP_TARGETS = Object.values(APP_META).filter(app => app.phase === 'v1');
export const APP_ALIASES: Record<string, AppId> = { island: 'maps', kooda: 'trash', 'read me': 'readme', 'pin the city': 'maps' };
export const cv: CommandHandler = (args, context) => {
  if (args.length) return usageError('cv');
  context.open('cv');
  return { ok: true, lines: [[segment('Opening CV. The PDF is at '),
    segment('/Nipun_Theekshana_CV.pdf', 'link', '/Nipun_Theekshana_CV.pdf')]] };
};
export const open: CommandHandler = async (args, context) => {
  if (!args.length) return usageError('open');
  const input = args.join(' '); const name = input.toLowerCase();
  const app = APP_TARGETS.find(app => app.id === name || app.name.toLowerCase() === name)?.id ?? APP_ALIASES[name];
  if (app) {
    context.open(app, { ...(name === 'pin the city' && { route: 'play' }), ...(app === 'terminal' && { newInstance: true }) });
    return { ok: true, lines: [[segment(`Opening ${APP_META[app].name}.`, 'link', APP_META[app].basePath)]] };
  }
  const data = await context.data(); context.signal?.throwIfAborted();
  if (['github', 'linkedin', 'prabhava'].includes(name)) {
    const url = data.profile.links[name as 'github' | 'linkedin' | 'prabhava'];
    context.external(url);
    return { ok: true, lines: [[segment('Opening '), segment(url, 'link', url), segment(' in a new tab…')]] };
  }
  const file = buildVfs(data).get(resolvePath(input, context.cwd));
  let target = file?.target ?? input;
  if (!target.startsWith('/') && !/^https?:\/\//i.test(target)) target = '/' + target;
  let url: URL;
  try { url = new URL(target, 'https://os.nipuntheekshana.com'); } catch { return failure(`open: ${input}: No such target`); }
  if (!['os.nipuntheekshana.com', 'nipuntheekshana.com', 'localhost', '127.0.0.1'].includes(url.hostname)
    || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return failure(`open: ${input}: No such target`);
  const matched = matchRoute(url.pathname);
  if (!matched || !APP_TARGETS.some(app => app.id === matched.appId)) return failure(`open: ${input}: No such target`);
  if (matched.appId === 'projects' && matched.route && !data.projects.some(project => project.slug === matched.route)) return failure(`open: ${input}: No such target`);
  if (matched.appId === 'writing' && matched.route && !data.posts.some(post => post.slug === matched.route)) return failure(`open: ${input}: No such target`);
  context.open(matched.appId, { route: matched.route, ...(matched.appId === 'terminal' && { newInstance: true }) });
  return { ok: true, lines: [[segment(`Opening ${input}.`, 'link', url.pathname)]] };
};
