import { contactLines, nowLines } from '../vfs';
import { segment, success, type CommandHandler } from '../types';
import { usageError } from './help';

const truncate = (text: string, width: number) => text.length <= width ? text : text.slice(0, Math.max(0, width - 1)) + '…';
export const content: Record<string, CommandHandler> = {
  whoami: args => args.length ? usageError('whoami') : success('nipun — engineer from Sri Lanka. Co-founder & CTO at PerfectUs, founder of Prabhava Labs.'),
  now: async (args, context) => args.length ? usageError('now') : { ok: true, lines: nowLines(await context.data()) },
  contact: async (args, context) => args.length ? usageError('contact') : { ok: true, lines: contactLines(await context.data()) },
  projects: async (args, context) => {
    const filters: Record<string, string> = {};
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i]!; const value = args[i + 1];
      const allowed = flag === '--category' ? ['data', 'apps', 'hardware', 'worlds', 'ai']
        : flag === '--status' ? ['active', 'incubating'] : [];
      if (!value || !allowed.includes(value) || filters[flag]) return usageError('projects');
      filters[flag] = value;
    }
    const data = await context.data();
    const projects = data.projects.filter(project => (!filters['--category'] || project.category === filters['--category'])
      && (!filters['--status'] || project.status === filters['--status']));
    const slugWidth = Math.max(4, ...projects.map(project => project.slug.length));
    const prefixWidth = slugWidth + 19;
    const lines = [[segment(`${'slug'.padEnd(slugWidth)}  year  status      tagline`, 'dim')],
      ...projects.map(project => [segment(project.slug, 'link', `/projects/${project.slug}`),
        segment(`${' '.repeat(slugWidth - project.slug.length)}  ${project.year}  ${project.status.padEnd(10)}  `),
        segment(truncate(project.tagline, Math.max(8, context.columns - prefixWidth)))]),
      [segment(`${projects.length} projects. open projects/<slug> for one.`, 'dim')]];
    return { ok: true, lines };
  },
  writing: async (args, context) => {
    if (args.length) return usageError('writing');
    return { ok: true, lines: (await context.data()).posts.map(post => [segment(`${post.date}  `, 'dim'),
      segment(post.slug, 'link', `/writing/${post.slug}`), segment(`  ${post.title}`)]) };
  },
};
content.socials = content.contact!;
