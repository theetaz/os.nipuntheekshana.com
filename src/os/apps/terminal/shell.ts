import { content } from './commands/content';
import { filesystem } from './commands/filesystem';
import { fun } from './commands/fun';
import { help } from './commands/help';
import { cv, open } from './commands/open';
import { system } from './commands/system';
import { failure, segment, type CommandHandler, type Line, type ShellContext } from './types';

export interface Token { kind: 'word' | 'and'; value: string; start: number; end: number }
export class ShellSyntaxError extends Error {}
/** A deliberately small shell: quoting, escaping and &&; never evaluates JavaScript or OS commands. */
export function tokenize(source: string, partial = false): Token[] {
  const tokens: Token[] = []; let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i]!)) { i++; continue; }
    if (source.slice(i, i + 2) === '&&') { tokens.push({ kind: 'and', value: '&&', start: i, end: i + 2 }); i += 2; continue; }
    const start = i; let value = ''; let quote: string | null = null;
    while (i < source.length) {
      const char = source[i]!;
      if (!quote && (/\s/.test(char) || source.slice(i, i + 2) === '&&')) break;
      if (char === '\\' && quote !== "'") {
        if (i + 1 >= source.length) { if (!partial) throw new ShellSyntaxError('Trailing escape'); i++; break; }
        value += source[i + 1]; i += 2; continue;
      }
      if (quote) { if (char === quote) quote = null; else value += char; i++; continue; }
      if (char === '"' || char === "'") { quote = char; i++; continue; }
      if (';&|<>'.includes(char)) throw new ShellSyntaxError(`Unsupported operator: ${char}`);
      value += char; i++;
    }
    if (quote && !partial) throw new ShellSyntaxError('Unclosed quote');
    tokens.push({ kind: 'word', value, start, end: i });
  }
  return tokens;
}
export function parse(source: string): string[][] {
  const tokens = tokenize(source); if (!tokens.length) return [];
  const commands: string[][] = [[]];
  for (const token of tokens) {
    if (token.kind === 'and') {
      if (!commands.at(-1)!.length) throw new ShellSyntaxError('Expected command before &&');
      commands.push([]);
    } else commands.at(-1)!.push(token.value);
  }
  if (!commands.at(-1)!.length) throw new ShellSyntaxError('Expected command after &&');
  return commands;
}
export const COMMANDS: Readonly<Record<string, CommandHandler>> = { help, ...filesystem, ...content, open, cv, ...system, ...fun };
export interface ShellResult { lines: Line[]; ok: boolean; cwd: string; clear: boolean }
export async function dispatch(source: string, context: ShellContext): Promise<ShellResult> {
  let commands: string[][];
  try { commands = parse(source); }
  catch (error) { return { ...failure(`nsh: ${error instanceof Error ? error.message : 'Syntax error'}`), cwd: context.cwd, clear: false }; }
  let lines: Line[] = []; let ok = true; let clear = false;
  for (const [name = '', ...args] of commands) {
    context.signal?.throwIfAborted();
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
    try {
      const result = handler ? await handler(args, context) : { ok: false, lines: [[segment('nsh: command not found: '),
        segment(name, 'err'), segment('. Try help.')]] };
      context.signal?.throwIfAborted();
      if (result.clear) { lines = []; clear = true; }
      lines.push(...result.lines); ok = result.ok;
      if (!ok || result.exit) break;
    } catch (error) {
      if (context.signal?.aborted) throw error;
      lines.push(...failure(`nsh: ${error instanceof Error ? error.message : "Couldn't run command"} Try again.`).lines);
      ok = false; break;
    }
  }
  return { lines, ok, cwd: context.cwd, clear };
}
export function appendHistory(history: readonly string[], command: string): string[] {
  return command.trim() ? [...history, command].slice(-100) : [...history];
}
export function capScrollback(lines: readonly Line[]): Line[] { return lines.slice(-600); }
