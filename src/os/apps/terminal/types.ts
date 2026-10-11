import type { AppId } from '../../types/apps';
import type { ClientActivity, ClientPostSummary, ClientProfile, ClientProject } from '../../types/content';
import type { api } from '../../mochi/api';

export type Tone = 'ink' | 'user' | 'host' | 'path' | 'dim' | 'err' | 'ok' | 'link';
export interface Segment { text: string; tone?: Tone; href?: string }
export type Line = Segment[];
export interface TerminalSeed { login: string; kernel: string; fontUrl?: string }
export interface TerminalData {
  profile: ClientProfile; projects: ClientProject[]; posts: ClientPostSummary[];
}
export interface SystemInfo {
  theme: 'light' | 'dark'; appearance: 'light' | 'dark' | 'auto'; wallpaper: string;
  accent: string; sound: boolean; kernel: string;
}
export interface ShellContext {
  cwd: string; columns: number; history: readonly string[];
  data(): Promise<TerminalData>;
  activity(): Promise<ClientActivity>;
  system(): SystemInfo;
  now(): Date;
  run(command: string): void;
  open(app: AppId, options?: { route?: string; query?: Record<string, string>; newInstance?: boolean }): void;
  external(url: string): void;
  close(): void;
  mochi: typeof api;
  signal?: AbortSignal;
}
export interface CommandResult { lines: Line[]; ok: boolean; clear?: boolean; exit?: boolean }
export type CommandHandler = (args: string[], context: ShellContext) => CommandResult | Promise<CommandResult>;
export const segment = (text: string, tone?: Tone, href?: string): Segment => ({ text, tone, href });
export const textLines = (text: string, tone?: Tone): Line[] => text.split('\n').map(text => [segment(text, tone)]);
export const success = (text = ''): CommandResult => ({ ok: true, lines: text ? textLines(text) : [] });
export const failure = (text: string): CommandResult => ({ ok: false, lines: textLines(text, 'err') });
export const outputText = (lines: readonly Line[]) => lines.map(line => line.map(part => part.text).join('')).join('\n');
