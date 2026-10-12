import { describe, expect, it, vi } from 'vitest';
import type { ClientProfile, ClientProject } from '../../src/os/types/content';
import { appendHistory, capScrollback, COMMANDS, dispatch, parse, ShellSyntaxError, tokenize } from '../../src/os/apps/terminal/shell';
import { buildVfs, displayPath, HOME, listDirectory, resolvePath } from '../../src/os/apps/terminal/vfs';
import { complete } from '../../src/os/apps/terminal/complete';
import { outputText, segment, type ShellContext, type TerminalData } from '../../src/os/apps/terminal/types';
import { HELP, USAGE } from '../../src/os/apps/terminal/commands/help';
import { dateText, loginText } from '../../src/os/apps/terminal/commands/system';
import { ISLAND, TEA } from '../../src/os/apps/terminal/ascii';

const data: TerminalData = {
  profile: {
    site: { email: 'nipun@example.com', careerStart: 2016, location: 'Colombo, Sri Lanka', coordinates: { lat: 6.9271, lon: 79.8612 } },
    summary: 'Engineer from Sri Lanka. Building tools for people.',
    now: { updated: '2026-10-11', items: ['Shipping Kottu OS.', 'Drinking tea.'] },
    links: { github: 'https://github.com/theetaz', linkedin: 'https://linkedin.com/in/nipun', prabhava: 'https://prabhava.io' },
  } as ClientProfile,
  projects: [
    { slug: 'salli', title: 'Salli', tagline: 'Money, thoughtfully.', description: 'A personal finance app.', status: 'active', year: 2026, category: 'apps', stack: ['Go', 'React'], live: 'https://salli.app', repo: 'https://github.com/theetaz/salli', story: '/projects/salli' },
    { slug: 'openrows', title: 'OpenRows', tagline: 'Open data infrastructure.', description: 'A database client.', status: 'incubating', year: 2025, category: 'data', stack: ['Rust'] },
  ] as ClientProject[],
  posts: [{ slug: 'hello-world', title: 'Hello world', date: '2026-10-01', description: 'An island made of words.', kind: 'notes', tags: [], minutes: 1 }],
};
function context(): ShellContext {
  return {
    cwd: HOME, columns: 80, history: ['ls', 'whoami'], data: vi.fn(async () => data),
    activity: vi.fn(async () => ({ available: true, total: 1234 } as const) as never),
    system: () => ({ theme: 'light', appearance: 'auto', wallpaper: 'kottu', accent: 'thambili', sound: false, kernel: 'Astro 7 + React 19' }),
    now: () => new Date('2026-10-11T17:41:00Z'), run: vi.fn(), open: vi.fn(), external: vi.fn(), close: vi.fn(),
    mochi: { pet: vi.fn(), give: vi.fn(), setMood: vi.fn(), say: vi.fn(), sleep: vi.fn(), wake: vi.fn(), wave: vi.fn(), hide: vi.fn(), show: vi.fn(), getState: () => ({ mood: 'happy', pets: 3, visible: true }) },
  };
}
const runText = async (source: string, ctx = context()) => outputText((await dispatch(source, ctx)).lines);

describe('Terminal tokenizer and parser', () => {
  it.each([
    ['echo "hello world"', [['echo', 'hello world']]], ["echo 'a && b'", [['echo', 'a && b']]],
    ['echo one\\ two', [['echo', 'one two']]], ['echo "" \'\'', [['echo', '', '']]],
    ['echo pre"two words"post', [['echo', 'pretwo wordspost']]], ['cd projects&&ls -a', [['cd', 'projects'], ['ls', '-a']]],
    ['  \t\n', []], ['echo "a\\\"b"', [['echo', 'a"b']]], ["echo 'a\\b'", [['echo', 'a\\b']]],
    ['echo \\&\\&', [['echo', '&&']]], ['echo "$(whoami)"', [['echo', '$(whoami)']]],
  ])('parses %s without execution', (source, expected) => expect(parse(source)).toEqual(expected));
  it.each(['&& ls', 'ls &&', 'ls && && pwd', 'echo "unclosed', "echo 'unclosed", 'echo trailing\\', 'ls;pwd', 'ls|pwd', 'echo x > file', 'ls & pwd'])('rejects malformed %s', source => {
    expect(() => parse(source)).toThrow(ShellSyntaxError);
  });
  it('retains offsets and supports incomplete quotes for completion', () => {
    expect(tokenize('cat "now', true)).toEqual([{ kind: 'word', value: 'cat', start: 0, end: 3 }, { kind: 'word', value: 'now', start: 4, end: 8 }]);
  });
  it('reports syntax before any command has side effects', async () => {
    const ctx = context(); expect(await runText('theme dark &&', ctx)).toBe('nsh: Expected command after &&'); expect(ctx.run).not.toHaveBeenCalled();
  });
  it('short-circuits failures, propagates cwd, clear and exit', async () => {
    const ctx = context();
    expect(await runText('cd projects && pwd && ls', ctx)).toContain('/home/nipun/projects'); expect(ctx.cwd).toBe(HOME + '/projects');
    expect(await runText('cd missing && theme dark', ctx)).toContain('No such file'); expect(ctx.run).not.toHaveBeenCalled();
    expect(await dispatch('echo before && clear && echo after', ctx)).toMatchObject({ clear: true, lines: [[{ text: 'after' }]] });
    expect(await runText('exit && theme dark', ctx)).toBe(''); expect(ctx.close).toHaveBeenCalledOnce(); expect(ctx.run).not.toHaveBeenCalled();
  });
  it('does not dispatch inherited object properties', async () => expect(await runText('constructor')).toBe('nsh: command not found: constructor. Try help.'));
  it('turns load failures into retryable output and permits interruption', async () => {
    const ctx = context(); ctx.data = vi.fn(async () => { throw new Error("Couldn't load data (503)."); });
    expect(await runText('ls', ctx)).toBe("nsh: Couldn't load data (503). Try again.");
    const controller = new AbortController(); ctx.signal = controller.signal; controller.abort();
    await expect(dispatch('theme dark', ctx)).rejects.toThrow(); expect(ctx.run).not.toHaveBeenCalled();
  });
  it('bounds history and scrollback without changing their order', () => {
    expect(appendHistory(['ls'], ' ')).toEqual(['ls']);
    const history = appendHistory(Array.from({ length: 100 }, (_, i) => String(i)), 'now');
    expect(history).toHaveLength(100); expect(history[0]).toBe('1'); expect(history.at(-1)).toBe('now');
    const lines = capScrollback(Array.from({ length: 700 }, (_, i) => [segment(String(i))]));
    expect(lines).toHaveLength(600); expect(outputText(lines).split('\n')[0]).toBe('100');
  });
});

describe('Terminal VFS', () => {
  it.each([
    ['~', HOME], ['~/projects/../now.txt', HOME + '/now.txt'], ['.', HOME], ['..', '/home'],
    ['../../../../etc//kottu-release', '/etc/kottu-release'], ['/../../', '/'], ['projects/./salli.md', HOME + '/projects/salli.md'],
  ])('resolves %s to %s', (input, expected) => expect(resolvePath(input)).toBe(expected));
  it('displays home only on an actual path boundary', () => {
    expect(displayPath(HOME)).toBe('~'); expect(displayPath(HOME + '/projects')).toBe('~/projects'); expect(displayPath(HOME + '2')).toBe(HOME + '2');
  });
  it('builds text, links, binary metadata and hidden files from content', () => {
    const vfs = buildVfs(data);
    expect(vfs.get(HOME + '/cv.pdf')?.kind).toBe('binary');
    expect(outputText(vfs.get(HOME + '/about.md')!.lines)).toBe(data.profile.summary);
    expect(outputText(vfs.get(HOME + '/now.txt')!.lines)).toBe('1. Shipping Kottu OS.\n2. Drinking tea.\nUpdated 2026-10-11');
    expect(outputText(vfs.get(HOME + '/projects/salli.md')!.lines)).toBe('Salli\nMoney, thoughtfully.\nactive · 2026 · apps\nStack: Go, React\nA personal finance app.\nlive: https://salli.app\nrepo: https://github.com/theetaz/salli\nstory: /projects/salli\nopen projects/salli for the full page');
    expect(outputText(vfs.get(HOME + '/writing/hello-world.md')!.lines)).toBe('Hello world\n2026-10-01\nAn island made of words.\nopen writing/hello-world to read it');
    expect(listDirectory(vfs, HOME).map(e => e.name)).toEqual(['about.md', 'contact.txt', 'cv.pdf', 'now.txt', 'projects', 'writing']);
    expect(listDirectory(vfs, HOME, true)).toHaveLength(8); expect(listDirectory(vfs, HOME + '/projects')).toHaveLength(2);
    expect(listDirectory(vfs, '/').map(e => e.name)).toEqual(['etc', 'home']);
  });
  it('lists 18 content files without hardcoding a count', async () => {
    const ctx = context(); ctx.data = async () => ({ ...data, projects: Array.from({ length: 18 }, (_, i) => ({ ...data.projects[0]!, slug: `project-${i}` })) });
    const text = await runText('cd projects && ls', ctx); expect(text.match(/project-\d+\.md/g)).toHaveLength(18);
  });
});

describe('Terminal command outputs and effects', () => {
  it.each([
    ['help', HELP], ['help cat', 'Usage: cat <file>\nExample: cat now.txt'],
    ['whoami', 'nipun — engineer from Sri Lanka. Co-founder & CTO at PerfectUs, founder of Prabhava Labs.'],
    ['pwd', HOME], ['now', '1. Shipping Kottu OS.\n2. Drinking tea.\nUpdated 2026-10-11'],
    ['cat now.txt', '1. Shipping Kottu OS.\n2. Drinking tea.\nUpdated 2026-10-11'],
    ['cat .mochirc', 'mood=content\nfavourite_snack=kiribath\nnap_after=45s'],
    ['cat .secrets', 'Tea powers the build.\nMochi runs the help desk.\nThere are no secrets in a read-only archive.'],
    ['cat cv.pdf', 'cat: cv.pdf: binary file. Try: open cv'], ['cat projects', 'cat: projects: Is a directory'],
    ['cat missing', 'cat: missing: No such file or directory'], ['ls missing', 'ls: missing: No such file or directory'],
    ['cd now.txt', 'cd: now.txt: Not a directory'], ['cd missing', 'cd: missing: No such file or directory'],
    ['cat /etc/kottu-release', 'Kottu OS 2.0 "Pettah"\nShell: nsh 1.0'],
    ['writing', '2026-10-01  hello-world  Hello world'], ['theme', 'auto'], ['theme dark', 'dark'],
    ['wallpaper', 'kottu'], ['wallpaper pettah', 'pettah'], ['accent', 'thambili'], ['accent lagoon', 'lagoon'],
    ['accent list', 'thambili\nlagoon\nlotus\ntea'], ['sound', 'on'], ['sound on', 'on'], ['sound off', 'off'],
    ['history', '  1  ls\n  2  whoami'], ['echo "hello world"', 'hello world'],
    ['tea', [...TEA, 'Ceylon tea. Strong, no sugar. Brewing… done.'].join('\n')],
    ['make tea', [...TEA, 'Ceylon tea. Strong, no sugar. Brewing… done.'].join('\n')],
    ['sudo rm /', 'nipun is not in the sudoers file. This incident will be reported to Mochi.'],
    ['rm now.txt', 'rm: read-only file system. Everything here is open source anyway: github.com/theetaz'],
    ['vim', 'No editors here. This file system is read-only, like a good archive.'],
    ['nano', 'No editors here. This file system is read-only, like a good archive.'],
    ['emacs', 'No editors here. This file system is read-only, like a good archive.'],
    ['ssh kottu', 'ssh: connect to host: connection refused. Try contact instead.'],
    ['ayubowan', 'ආයුබෝවන්. (Sinhala: "may you live long" — the everyday greeting.)'],
    ['mochi', 'Mochi: happy. 3 pets.'], ['pin', 'Opening Pin the city.'], ['sleep', ''],
    ['unknown', 'nsh: command not found: unknown. Try help.'], ['clear', ''], ['exit', ''],
  ])('%s matches the specified copy', async (source, expected) => expect(await runText(source)).toBe(expected));
  it('covers every dispatcher command with help and runnable fixtures', () => expect(Object.keys(COMMANDS).sort()).toEqual(Object.keys(USAGE).sort()));
  it('formats dates in Colombo and at the visitor location', () => {
    expect(dateText(context().now())).toMatch(/^Sun 11 Oct 2026, 23:11 in Colombo \(UTC\+05:30\) · \d{2}:\d{2} where you are$/);
    expect(loginText(context().now(), 2)).toBe('Last login: Sun 11 Oct 23:11 on ttys002 (Colombo time)');
  });
  it('returns coloured directory columns and respects -a and --', async () => {
    const ctx = context(); ctx.columns = 10;
    const result = await dispatch('ls -a', ctx); expect(result.lines).toHaveLength(8); expect(outputText(result.lines)).toContain('.secrets');
    expect(result.lines.flat().filter(p => p.tone === 'path').map(p => p.text)).toEqual(['projects/', 'writing/']);
    expect(await runText('ls -- ~/now.txt')).toBe('now.txt');
  });
  it('filters and sizes the project table using live counts', async () => {
    expect(await runText('projects')).toContain('2 projects. open projects/<slug> for one.');
    const result = await runText('projects --category data --status incubating'); expect(result).toContain('openrows'); expect(result).not.toContain('salli'); expect(result).toContain('1 projects.');
    const ctx = context(); ctx.columns = 20; expect(await runText('projects', ctx)).toContain('…');
  });
  it('links contact aliases and each project/post to canonical targets', async () => {
    const result = await dispatch('contact', context()); expect(result.lines.flat().filter(p => p.href).map(p => p.href)).toEqual(['mailto:nipun@example.com', ...Object.values(data.profile.links)]);
    expect(await runText('socials')).toBe(await runText('contact'));
    expect(outputText(result.lines)).toBe('Email: nipun@example.com\nGitHub: https://github.com/theetaz\nLinkedIn: https://linkedin.com/in/nipun\nPrabhava Labs: https://prabhava.io');
  });
  it.each([
    ['open projects/salli', 'projects', { route: 'salli' }], ['open writing/hello-world', 'writing', { route: 'hello-world' }],
    ['open now.txt', 'now', { route: '' }], ['open ~/projects/salli.md', 'projects', { route: 'salli' }],
    ['open island', 'maps', {}], ['open "Pin the city"', 'maps', { route: 'play' }], ['open terminal', 'terminal', { newInstance: true }],
    ['open https://os.nipuntheekshana.com/projects/salli', 'projects', { route: 'salli' }], ['open kooda', 'trash', {}],
  ])('%s opens the intended window', async (source, app, options) => {
    const ctx = context(); expect((await dispatch(source, ctx)).ok).toBe(true); expect(ctx.open).toHaveBeenCalledWith(app, options);
  });
  it('opens CV and the three external aliases through the API', async () => {
    const ctx = context(); expect(await runText('cv', ctx)).toBe('Opening CV. The PDF is at /Nipun_Theekshana_CV.pdf'); expect(ctx.open).toHaveBeenCalledWith('cv');
    for (const name of ['github', 'linkedin', 'prabhava'] as const) {
      const url = data.profile.links[name]; expect(await runText(`open ${name}`, ctx)).toBe(`Opening ${url} in a new tab…`); expect(ctx.external).toHaveBeenCalledWith(url);
    }
  });
  it.each(['projects/missing', 'writing/missing', 'https://evil.test/projects/salli', 'javascript:alert(1)', 'https://user@os.nipuntheekshana.com/about', 'not-a-target'])('rejects unsafe/unknown target %s', async target => {
    const ctx = context(); expect((await dispatch(`open ${target}`, ctx)).ok).toBe(false); expect(ctx.open).not.toHaveBeenCalled(); expect(ctx.external).not.toHaveBeenCalled();
  });
  it('routes preference/power and Mochi effects through the existing APIs', async () => {
    const ctx = context(); await dispatch('theme dark && wallpaper paper && accent tea && sound on && sleep', ctx);
    expect(vi.mocked(ctx.run).mock.calls.map(args => args[0])).toEqual(['theme.dark', 'wallpaper.paper', 'accent.tea', 'os.sound', 'os.sleep']);
    for (const action of ['pet', 'sleep', 'wake', 'hide', 'show'] as const) { await dispatch(`mochi ${action}`, ctx); expect(ctx.mochi[action]).toHaveBeenCalledOnce(); }
    await dispatch(`mochi say "${'x'.repeat(100)}"`, ctx); expect(ctx.mochi.say).toHaveBeenCalledWith('x'.repeat(80));
    await dispatch('sudo hello', ctx); expect(ctx.mochi.setMood).toHaveBeenCalledWith('surprised');
    await dispatch('ayubowan', ctx); expect(ctx.mochi.wave).toHaveBeenCalledOnce();
    await dispatch('pin', ctx); expect(ctx.open).toHaveBeenCalledWith('maps', { route: 'play' });
  });
  it('neofetch uses live counts, theme, career and build activity', async () => {
    const text = await runText('neofetch'); expect(text.split('\n')).toHaveLength(ISLAND.length + 1);
    for (const expected of ['Kottu OS 2.0 "Pettah"', 'nipun@kottu', 'Hyprland-ish (in your browser)', '2 projects, 1 posts', '10 years (shipping since 2016)', 'Kottu (light), accent Thambili', '1,234 GitHub contributions this year', '6.9271°N 79.8612°E', 'Astro 7 + React 19']) expect(text).toContain(expected);
    const ctx = context(); ctx.activity = async () => { throw new Error('offline'); }; expect(await runText('neofetch', ctx)).toContain('GitHub contributions unavailable');
  });
  it.each(['ls -z', 'cat', 'cat a b', 'cd a b', 'pwd x', 'projects --status archived', 'projects --category', 'projects --bogus data', 'projects --category data --category ai', 'writing x', 'theme sepia', 'accent orange', 'wallpaper random', 'sound maybe', 'mochi run', 'mochi say', 'make coffee', 'open', 'exit x', 'clear x', 'sleep x'])('validates usage for %s without side effects', async source => {
    const ctx = context(); expect(await runText(source, ctx)).toMatch(/^Usage:/); expect(ctx.run).not.toHaveBeenCalled(); expect(ctx.open).not.toHaveBeenCalled(); expect(ctx.close).not.toHaveBeenCalled();
  });
});

describe('Terminal completion', () => {
  const vfs = buildVfs(data);
  const completion = (source: string, cwd = HOME) => complete(source, source.length, cwd, vfs);
  it.each([
    ['neo', 'neofetch '], ['echo hi && neo', 'echo hi && neofetch '], ['cat no', 'cat now.txt '], ['cd pro', 'cd projects/'],
    ['ls ~/pro', 'ls ~/projects/'], ['cat projects/sa', 'cat projects/salli.md '], ['open projects/sa', 'open projects/salli '],
    ['open writing/he', 'open writing/hello-world '], ['open isl', 'open island '], ['theme da', 'theme dark '],
    ['wallpaper pet', 'wallpaper pettah '], ['accent lag', 'accent lagoon '], ['sound of', 'sound off '], ['mochi wa', 'mochi wake '],
    ['projects --category da', 'projects --category data '], ['projects --status ac', 'projects --status active '],
    ['help neo', 'help neofetch '], ['make te', 'make tea '], ['cat "no', 'cat "now.txt" '], ['cat .sec', 'cat .secrets '],
  ])('completes %s', (source, expected) => expect(completion(source).value).toBe(expected));
  it('returns candidates, common prefixes and no-op for unknowns', () => {
    expect(completion('c').candidates).toEqual(['cat', 'cd', 'clear', 'contact', 'cv']);
    expect(completion('cat ').candidates).not.toContain('.secrets'); expect(completion('cd ').candidates).toEqual(['projects/', 'writing/']);
    expect(completion('mochi s').value).toBe('mochi s'); expect(completion('mochi s').candidates).toEqual(['say', 'show', 'sleep']);
    expect(completion('nonsense').value).toBe('nonsense'); expect(completion('echo >').candidates).toEqual([]);
  });
  it('supports nested cwd, parent/absolute paths, mid-line cursor and command completion without VFS', () => {
    expect(completion('cat sa', HOME + '/projects').value).toBe('cat salli.md ');
    expect(completion('cat ../no', HOME + '/projects').value).toBe('cat ../now.txt ');
    expect(completion('cat /etc/kot').value).toBe('cat /etc/kottu-release ');
    expect(complete('neo && pwd', 3, HOME).value).toBe('neofetch && pwd');
    expect(complete('neoBROKEN && pwd', 3, HOME).value).toBe('neofetch && pwd');
    expect(complete('cat "now.txt" && pwd', 7, HOME, vfs).value).toBe('cat "now.txt" && pwd');
    expect(complete('neo', 3, HOME).value).toBe('neofetch ');
  });
});
