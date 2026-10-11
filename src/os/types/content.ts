import type { AppId } from './apps';

export interface ImageSet {
  /** WebP at the largest generated width, or the original SVG URL. */
  src: string;
  /** Original intrinsic dimensions, for the aspect ratio. */
  width: number;
  height: number;
  avif: string;
  webp: string;
  alt: string;
}
export type ScreenKind = 'phone' | 'browser' | 'bare';
export interface ClientScreen extends ImageSet { label: string; kind: ScreenKind; trimBottom?: number; bar?: string }
export type Category = 'data' | 'apps' | 'hardware' | 'worlds' | 'ai';
export type BrandCard =
  | { kind: 'stat'; label: string; value: string; note?: string; progress?: number }
  | { kind: 'steps'; label: string; steps: string[]; footnote?: string }
  | { kind: 'code'; label: string; lines: string[]; footnote?: string };
export interface BrandApi { method: string; host: string; path: string; status: string; time?: string; body: string }
export interface ClientBrand {
  color: string; ink: string; shade?: string; backdrop: { dark: string; light: string };
  platform: string; platformNote: string; chips: string[];
  cta?: { label: string; href: string }; domain?: string; address?: string;
  cards: BrandCard[]; api?: BrandApi;
}
export interface ClientProject {
  slug: string; title: string; native?: string; tagline: string; description: string;
  category: Category; categoryLabel: string; stack: string[];
  status: 'active' | 'incubating' | 'archived'; year: number;
  repo?: string; live?: string; story?: string; featured: boolean; tint?: number;
  icon: ImageSet | null;
  monogram: string;
  cover: ImageSet;
  screens: ClientScreen[];
  brand: ClientBrand | null;
  /** Featured first, then year descending, then title. */
  order: number;
}
export interface ClientArchiveItem { title: string; note: string; year: string; stack: string }
export interface ClientWork { slug: string; lede: string; role: string; facts: { value: string; label: string }[]; html: string; headings: { depth: number; slug: string; text: string }[] }
export interface ClientPostSummary { slug: string; title: string; description: string; date: string; updated?: string; kind: 'engineering' | 'notes' | 'life'; tags: string[]; minutes: number }
export interface ClientPost extends ClientPostSummary { html: string; headings: ClientWork['headings'] }
export interface ClientProfile {
  site: { name: string; nameSinhala: string; fullName: string; title: string; role: string; tagline: string; description: string; location: string; coordinates: { lat: number; lon: number }; timezone: string; email: string; careerStart: number };
  cv: { href: string; filename: string; updated: string; sizeLabel: string };
  links: Record<'github' | 'linkedin' | 'prabhava' | 'prabhavaGithub' | 'source', string>;
  socials: { label: string; handle: string; href: string }[];
  currently: string[]; highlights: { value: string; label: string }[]; summary: string; competencies: string[];
  experience: { org: string; role: string; period: string; location?: string; href?: string; summary: string; highlights?: string[]; stack?: string[] }[];
  education: { school: string; degree: string; period: string; location: string };
  skills: { group: string; items: string[] }[];
  principles: { title: string; body: string }[];
  hobbies: { name: string; note: string; icon: string }[];
  now: { updated: string; items: string[] };
  chapters: { year: string; title: string; body: string }[];
  avatar: ImageSet;
}
export type ClientActivity =
  | { available: true; start: string; weeks: number; counts: number[]; total: number; activeDays: number;
      longestStreak: number; currentStreak: number; busiest: { date: string; count: number } | null;
      busiestWeekday: number; stars: number | null; fetchedAt: string }
  | { available: false; fetchedAt: string };
export interface SearchEntry {
  id: string;
  kind: 'app' | 'project' | 'post' | 'action';
  title: string; subtitle: string; keywords: string; icon: string; featured?: boolean;
  target: { type: 'app'; appId: AppId; route?: string } | { type: 'action'; action: string } | { type: 'href'; href: string };
}
